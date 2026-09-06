import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureCorpusAsset, sha256Hex, CorpusLoadError } from "../../src/corpus-loader.js";
import type { Config } from "../../src/config.js";

const ASSET = Buffer.from("fake sqlite bytes for testing");
const HASH = sha256Hex(ASSET);

function config(overrides: Partial<Config> = {}): Config {
  return {
    cacheDir: mkdtempSync(join(tmpdir(), "ph-compliance-loader-")),
    releaseUrl: "https://example.test/releases/download",
    repo: "test/ph-compliance-mcp",
    confidenceThreshold: 0.4,
    downloadTimeoutMs: 60000,
    maxAssetBytes: 512 * 1024 * 1024,
    logLevel: "info",
    ...overrides,
  };
}

describe("ensureCorpusAsset", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("downloads and verifies a matching checksum", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(`${HASH}  laws.sqlite\n`, { status: 200 }))
      .mockResolvedValueOnce(new Response(ASSET, { status: 200 }));

    const cfg = config();
    const path = await ensureCorpusAsset(cfg, "laws");
    expect(path.endsWith("laws.sqlite")).toBe(true);
    const fetched = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(fetched.some((u) => u.includes("laws.sqlite.sha256"))).toBe(true);
    expect(fetched.some((u) => u.endsWith("laws.sqlite"))).toBe(true);
  });

  it("refuses to load on checksum mismatch", async () => {
    // Fresh Response per call: a consumed body cannot be re-read, and both
    // ensureCorpusAsset calls must hit the same mismatched checksum.
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).endsWith(".sha256")) return new Response(`${"ab".repeat(32)}  laws.sqlite\n`, { status: 200 });
      return new Response(ASSET, { status: 200 });
    });

    const cfg = config();
    await expect(ensureCorpusAsset(cfg, "laws")).rejects.toThrow(/checksum mismatch/);
    await expect(ensureCorpusAsset(cfg, "laws")).rejects.toThrow(CorpusLoadError);
  });

  it("reuses a verified cached asset without refetching", async () => {
    const cfg = config();
    const dbPath = join(cfg.cacheDir, "laws.sqlite");
    const sumPath = join(cfg.cacheDir, "laws.sqlite.sha256");
    writeFileSync(dbPath, ASSET);
    writeFileSync(sumPath, `${HASH}  laws.sqlite\n`);

    const path = await ensureCorpusAsset(cfg, "laws");
    expect(path).toBe(dbPath);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-downloads when the cached file is corrupted", async () => {
    const cfg = config();
    const dbPath = join(cfg.cacheDir, "laws.sqlite");
    writeFileSync(dbPath, Buffer.from("corrupted!"));
    writeFileSync(join(cfg.cacheDir, "laws.sqlite.sha256"), `${HASH}  laws.sqlite\n`);

    fetchMock
      .mockResolvedValueOnce(new Response(`${HASH}  laws.sqlite\n`, { status: 200 }))
      .mockResolvedValueOnce(new Response(ASSET, { status: 200 }));

    await ensureCorpusAsset(cfg, "laws");
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("laws.sqlite"))).toBe(true);
  });

  it("refuses to download when the checksum file is missing (fail closed)", async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).endsWith(".sha256")) return new Response("not found", { status: 404 });
      throw new Error("asset must not be downloaded without a checksum");
    });

    const cfg = config();
    await expect(ensureCorpusAsset(cfg, "laws")).rejects.toThrow(/refusing to download/);
    await expect(ensureCorpusAsset(cfg, "laws")).rejects.toThrow(CorpusLoadError);
    // Nothing was cached.
    const { access } = await import("node:fs/promises");
    await expect(access(join(cfg.cacheDir, "laws.sqlite"))).rejects.toThrow();
  });

  it("refuses when the checksum body is not a 64-hex sha256", async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).endsWith(".sha256")) return new Response("<html>502 Bad Gateway</html>", { status: 200 });
      throw new Error("asset must not be downloaded without a valid checksum");
    });

    await expect(ensureCorpusAsset(config(), "laws")).rejects.toThrow(/invalid checksum file/);
  });

  it("wraps fetch failures (timeout/abort) as CorpusLoadError", async () => {
    fetchMock.mockImplementation(async () => {
      const e = new Error("The operation was aborted due to timeout");
      e.name = "TimeoutError";
      throw e;
    });

    await expect(ensureCorpusAsset(config(), "laws")).rejects.toThrow(CorpusLoadError);
  });

  it("refuses an asset over the configured size cap (Content-Length)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(`${HASH}  laws.sqlite\n`, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(ASSET, {
          status: 200,
          headers: { "content-length": String(600 * 1024 * 1024) },
        }),
      );

    const cfg = config({ maxAssetBytes: 512 * 1024 * 1024 });
    await expect(ensureCorpusAsset(cfg, "laws")).rejects.toThrow(/safety cap/);
  });

  it("refuses a streamed asset that grows past the size cap", async () => {
    // Stream whose chunks total over the 64-byte cap (no honest Content-Length).
    const big = Buffer.alloc(100, 0x41);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(big);
        controller.enqueue(big);
        controller.close();
      },
    });
    fetchMock
      .mockResolvedValueOnce(new Response(`${HASH}  laws.sqlite\n`, { status: 200 }))
      .mockResolvedValueOnce(new Response(stream, { status: 200 }));

    const cfg = config({ maxAssetBytes: 64 });
    await expect(ensureCorpusAsset(cfg, "laws")).rejects.toThrow(/exceeds the 64-byte safety cap/);
  });

  it("uses a local corpus dir override when checksum matches", async () => {
    const localDir = mkdtempSync(join(tmpdir(), "ph-compliance-local-"));
    writeFileSync(join(localDir, "laws.sqlite"), ASSET);
    writeFileSync(join(localDir, "laws.sqlite.sha256"), `${HASH}  laws.sqlite\n`);

    const cfg = config({ localCorpusDir: localDir });
    const path = await ensureCorpusAsset(cfg, "laws");
    expect(path).toBe(join(localDir, "laws.sqlite"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
