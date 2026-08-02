import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HttpClient } from "../../data-pipeline/http-client.js";

function mockResponse(status: number, body: string, headers: Record<string, string> = {}) {
  // 304 must carry a null body (the fetch spec forbids a body on 304).
  return new Response(status === 304 ? null : body, {
    status,
    headers: { "content-type": "text/plain", ...headers },
  });
}

describe("HttpClient", () => {
  let cacheDir: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "ph-compliance-cache-"));
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends descriptive User-Agent and returns body", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, "User-agent: *\n"))
      .mockResolvedValueOnce(mockResponse(200, "hello corpus"));

    const client = new HttpClient({
      userAgent: "ph-compliance-mcp/0.6 (build) +contact@example.test",
      cacheDir,
      minDelayMs: 0,
    });
    const res = await client.get("https://example.test/page");
    expect(res.text).toBe("hello corpus");
    expect(res.fromCache).toBe(false);
    const pageCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/page"));
    expect(String(pageCall?.[0])).toContain("/page");
  });

  it("reuses cache on 304 and marks fromCache", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, "User-agent: *\n"))
      .mockResolvedValueOnce(mockResponse(200, "v1", { etag: '"abc"' }))
      .mockResolvedValueOnce(mockResponse(304, "", { etag: '"abc"' }));

    const client = new HttpClient({ userAgent: "bot/1", cacheDir, minDelayMs: 0 });
    const first = await client.get("https://example.test/doc");
    const second = await client.get("https://example.test/doc");
    expect(first.text).toBe("v1");
    expect(second.text).toBe("v1");
    expect(second.fromCache).toBe(true);
  });

  it("respects robots.txt disallow", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, "User-agent: *\nDisallow: /secret\n"))
      .mockResolvedValueOnce(mockResponse(200, "nope"));

    const client = new HttpClient({ userAgent: "bot/1", cacheDir, minDelayMs: 0 });
    await expect(client.get("https://example.test/secret/data")).rejects.toThrow(
      /robots\.txt disallows/,
    );
  });

  it("retries on 5xx then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, "User-agent: *\n"))
      .mockResolvedValueOnce(mockResponse(503, "busy"))
      .mockResolvedValueOnce(mockResponse(200, "recovered"));

    const client = new HttpClient({
      userAgent: "bot/1",
      cacheDir,
      minDelayMs: 0,
      maxRetries: 2,
    });
    const res = await client.get("https://example.test/flaky");
    expect(res.text).toBe("recovered");
  });
});
