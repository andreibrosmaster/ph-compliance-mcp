/**
 * corpus-loader (blueprint §3, §6, §17).
 *
 * Downloads the three corpus Release assets + their SHA-256 checksums, verifies
 * each before caching, and REFUSES to load on mismatch — a corrupted or tampered
 * asset must fail loudly, not silently serve bad citations.
 *
 * If PH_COMPLIANCE_LOCAL_CORPUS is set, assets are read from that dir instead
 * (CI/dev overrides; checksums still verified when present).
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
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

async function readChecksum(file: string): Promise<string | null> {
  try {
    const raw = await readFile(file, "utf8");
    // sha256sum format: "<hex>  <filename>"
    return raw.trim().split(/\s+/)[0] ?? null;
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

  // Local override: verify checksum if present, else warn and accept.
  if (config.localCorpusDir) {
    const localDb = join(config.localCorpusDir, assetName);
    if (await exists(localDb)) {
      const localSum = await readChecksum(join(config.localCorpusDir, checksumName));
      if (localSum) {
        const actual = sha256Hex(await readFile(localDb));
        if (actual !== localSum) {
          throw new CorpusLoadError(
            corpus,
            `local corpus checksum mismatch for ${assetName}: expected ${localSum}, got ${actual}`,
          );
        }
      }
      return localDb;
    }
  }

  await mkdir(config.cacheDir, { recursive: true });
  const dbPath = join(config.cacheDir, assetName);
  const sumPath = join(config.cacheDir, checksumName);

  // Already cached and verified?
  const cachedSum = await readChecksum(sumPath);
  if (cachedSum && (await exists(dbPath))) {
    const actual = sha256Hex(await readFile(dbPath));
    if (actual === cachedSum) return dbPath;
    // Cache corrupted — fall through to re-download.
  }

  // Download asset + checksum, then verify.
  const dbUrl = `${config.releaseUrl}/${assetName}`;
  const sumUrl = `${config.releaseUrl}/${checksumName}`;

  let expected: string | null = null;
  try {
    const sumRes = await fetch(sumUrl);
    if (sumRes.ok) {
      const sumText = await sumRes.text();
      expected = sumText.trim().split(/\s+/)[0] ?? null;
    } else {
      // Definitive 404: the release forgot to publish checksums. Do not proceed silently.
      process.stderr.write(
        `[ph-compliance] WARNING: checksum file not found (HTTP ${sumRes.status}) for ${assetName} — ` +
          `downloading WITHOUT integrity verification. Publish a .sha256 in the Release.\n`,
      );
    }
  } catch {
    process.stderr.write(
      `[ph-compliance] WARNING: could not fetch checksum for ${assetName} — downloading WITHOUT integrity verification.\n`,
    );
  }

  const dbRes = await fetch(dbUrl);
  if (!dbRes.ok) {
    throw new CorpusLoadError(
      corpus,
      `failed to download ${assetName} from ${dbUrl} (HTTP ${dbRes.status})`,
    );
  }
  const bytes = Buffer.from(await dbRes.arrayBuffer());
  const actual = sha256Hex(bytes);

  if (expected && actual !== expected) {
    throw new CorpusLoadError(
      corpus,
      `checksum mismatch for ${assetName}: expected ${expected}, got ${actual}. ` +
        `Refusing to cache/load. If you trust this download, publish a correct .sha256 in the Release.`,
    );
  }

  await writeFile(dbPath, bytes);
  if (expected) await writeFile(sumPath, `${expected}  ${assetName}\n`);
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
