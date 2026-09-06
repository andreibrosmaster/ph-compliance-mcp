/**
 * corpus-loader (blueprint §3, §6, §17).
 *
 * Downloads the three corpus Release assets + their SHA-256 checksums, verifies
 * each before caching, and REFUSES to load on mismatch — a corrupted or tampered
 * asset must fail loudly, not silently serve bad citations.
 *
 * Integrity is mandatory for downloaded assets: a missing or unreadable
 * checksum is a hard failure (fail closed), never a warn-and-continue. Local
 * corpus overrides (PH_COMPLIANCE_LOCAL_CORPUS — dev/CI/air-gapped mounts)
 * verify when a sidecar is present and warn when it is absent, because the
 * operator placed those bytes on disk deliberately.
 *
 * Downloads are timeout-bounded and size-bounded, and cache writes are atomic
 * (temp file + rename) so two server processes sharing a cache dir can never
 * observe a half-written SQLite file.
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CORPUS_ASSETS } from "./config.js";
import type { Config, CorpusName } from "./config.js";

export interface CorpusPaths {
  laws: string;
  cases: string;
  issuances: string;
}

export class CorpusLoadError extends Error {
  constructor(
    public readonly corpus: CorpusName,
    message: string,
  ) {
    super(message);
    this.name = "CorpusLoadError";
  }
}

export function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

const HEX64 = /^[a-f0-9]{64}$/i;

function parseChecksum(body: string, corpus: CorpusName, source: string): string {
  const sum = body.trim().split(/\s+/)[0] ?? "";
  if (!HEX64.test(sum)) {
    throw new CorpusLoadError(
      corpus,
      `invalid checksum file from ${source}: expected a 64-hex-char sha256, got ${JSON.stringify(
        sum.slice(0, 64),
      )}. Refusing to trust the download.`,
    );
  }
  return sum;
}

async function readChecksumFile(file: string): Promise<string | null> {
  try {
    const raw = await readFile(file, "utf8");
    // sha256sum format: "<hex>  <filename>"
    const sum = raw.trim().split(/\s+/)[0] ?? "";
    return HEX64.test(sum) ? sum.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Fetch with the configured timeout; surfaces aborts as CorpusLoadError. */
async function fetchBounded(
  url: string,
  config: Config,
  corpus: CorpusName,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(config.downloadTimeoutMs) });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CorpusLoadError(corpus, `failed to fetch ${url}: ${reason}`);
  }
  return res;
}

/**
 * Read a response body with a hard size cap. Checks Content-Length up front
 * (cheap early refusal) and enforces the cap while streaming (covers missing
 * or lying Content-Length headers).
 */
async function readBodyBounded(
  res: Response,
  maxBytes: number,
  corpus: CorpusName,
  url: string,
): Promise<Buffer> {
  const declared = res.headers.get("content-length");
  if (declared && Number.isFinite(Number(declared)) && Number(declared) > maxBytes) {
    throw new CorpusLoadError(
      corpus,
      `asset at ${url} is ${declared} bytes, over the ${maxBytes}-byte safety cap — refusing.`,
    );
  }
  const reader = res.body?.getReader();
  if (!reader) throw new CorpusLoadError(corpus, `empty response body from ${url}`);
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new CorpusLoadError(
        corpus,
        `asset at ${url} exceeds the ${maxBytes}-byte safety cap — refusing.`,
      );
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/** Atomic write: temp file in the same dir + rename, then fsync-free cleanup. */
async function writeFileAtomic(path: string, data: Buffer): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(tmp, data);
    await rename(tmp, path);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

/**
 * Ensure a single corpus asset is present, verified, and cached.
 * Returns the local path to the verified .sqlite file.
 */
export async function ensureCorpusAsset(
  config: Config,
  corpus: CorpusName,
): Promise<string> {
  const assetName = `${corpus}.sqlite`;
  const checksumName = `${corpus}.sqlite.sha256`;

  // Local override: verify checksum when present; warn (never throw) when the
  // operator-mounted corpus ships without a sidecar.
  if (config.localCorpusDir) {
    const localDb = join(config.localCorpusDir, assetName);
    if (await exists(localDb)) {
      const localSum = await readChecksumFile(join(config.localCorpusDir, checksumName));
      if (localSum) {
        const actual = sha256Hex(await readFile(localDb));
        if (actual !== localSum) {
          throw new CorpusLoadError(
            corpus,
            `local corpus checksum mismatch for ${assetName}: expected ${localSum}, got ${actual}`,
          );
        }
      } else {
        process.stderr.write(
          `[ph-compliance] WARNING: local corpus ${assetName} has no readable .sha256 sidecar — ` +
            `loaded WITHOUT integrity verification (local override). Publish a .sha256 next to it.\n`,
        );
      }
      return localDb;
    }
  }

  await mkdir(config.cacheDir, { recursive: true });
  const dbPath = join(config.cacheDir, assetName);
  const sumPath = join(config.cacheDir, checksumName);

  // Already cached and verified?
  const cachedSum = await readChecksumFile(sumPath);
  if (cachedSum && (await exists(dbPath))) {
    const actual = sha256Hex(await readFile(dbPath));
    if (actual === cachedSum) return dbPath;
    // Cache corrupted — fall through to re-download.
  }

  // Download asset + checksum, then verify. The checksum is REQUIRED: without
  // it there is no integrity anchor, and a corrupted or tampered corpus must
  // fail loudly instead of silently serving bad citations.
  const sumUrl = `${config.releaseUrl}/${checksumName}`;
  const dbUrl = `${config.releaseUrl}/${assetName}`;

  const sumRes = await fetchBounded(sumUrl, config, corpus);
  if (!sumRes.ok) {
    throw new CorpusLoadError(
      corpus,
      `checksum file not found (HTTP ${sumRes.status}) at ${sumUrl} — refusing to download ` +
        `${assetName} without integrity verification. Publish a .sha256 in the Release.`,
    );
  }
  const sumText = await sumRes.text();
  const expected = parseChecksum(sumText, corpus, sumUrl).toLowerCase();

  const dbRes = await fetchBounded(dbUrl, config, corpus);
  if (!dbRes.ok) {
    throw new CorpusLoadError(
      corpus,
      `failed to download ${assetName} from ${dbUrl} (HTTP ${dbRes.status})`,
    );
  }
  const bytes = await readBodyBounded(dbRes, config.maxAssetBytes, corpus, dbUrl);
  const actual = sha256Hex(bytes);

  if (actual !== expected) {
    throw new CorpusLoadError(
      corpus,
      `checksum mismatch for ${assetName}: expected ${expected}, got ${actual}. ` +
        `Refusing to cache/load. If you trust this download, publish a correct .sha256 in the Release.`,
    );
  }

  // Sum first, then bytes: a crash between the two leaves a stale sum that
  // mismatches the (old) bytes, forcing a clean re-download next start.
  await writeFileAtomic(sumPath, Buffer.from(`${expected}  ${assetName}\n`));
  await writeFileAtomic(dbPath, bytes);
  return dbPath;
}

/** Ensure all three corpus assets. Returns resolved local paths. */
export async function ensureCorpus(config: Config): Promise<CorpusPaths> {
  // CORPUS_ASSETS is a fixed 3-tuple; narrow the Promise.all result so the
  // destructure stays string under noUncheckedIndexedAccess.
  const [laws, cases, issuances] = (await Promise.all(
    CORPUS_ASSETS.map((c) => ensureCorpusAsset(config, c)),
  )) as [string, string, string];
  return { laws, cases, issuances };
}

/** Local cache age, used by list_domains freshness reporting (§14). */
export async function cachedCorpusFreshness(dbPath: string): Promise<string | null> {
  try {
    const s = await stat(dbPath);
    return s.mtime.toISOString();
  } catch {
    return null;
  }
}
