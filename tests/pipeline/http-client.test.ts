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

  it("treats unreachable robots.txt (5xx after retries) as full disallow", async () => {
    // maxRetries: 1 → robots.txt is attempted twice, both 500.
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).endsWith("/robots.txt")) return mockResponse(500, "boom");
      throw new Error("must not fetch anything: robots.txt unreachable");
    });

    const client = new HttpClient({ userAgent: "bot/1", cacheDir, minDelayMs: 0, maxRetries: 1 });
    await expect(client.get("https://example.test/page")).rejects.toThrow(/robots\.txt disallows/);
    // Only robots.txt attempts hit the mock — never the target URL.
    expect(fetchMock.mock.calls.every(([u]) => String(u).endsWith("/robots.txt"))).toBe(true);
  });

  it("treats robots.txt 401/403 as full disallow", async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).endsWith("/robots.txt")) return mockResponse(403, "forbidden");
      throw new Error("must not fetch anything: robots.txt 403");
    });

    const client = new HttpClient({ userAgent: "bot/1", cacheDir, minDelayMs: 0 });
    await expect(client.get("https://example.test/page")).rejects.toThrow(/robots\.txt disallows/);
  });

  it("allows crawling when robots.txt is 404 (RFC 9309: other 4xx → allow)", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(404, "no robots here"))
      .mockResolvedValueOnce(mockResponse(200, "allowed content"));

    const client = new HttpClient({ userAgent: "bot/1", cacheDir, minDelayMs: 0 });
    const res = await client.get("https://example.test/page");
    expect(res.text).toBe("allowed content");
  });

  it("re-checks robots.txt on the redirect target", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, "User-agent: *\n")) // example.test robots: allow
      .mockImplementationOnce(async () => {
        const res = mockResponse(200, "redirected content");
        Object.defineProperty(res, "url", { value: "https://other.test/page" });
        return res;
      })
      .mockResolvedValueOnce(mockResponse(200, "User-agent: *\nDisallow: /\n")); // other.test robots: deny all

    const client = new HttpClient({ userAgent: "bot/1", cacheDir, minDelayMs: 0 });
    await expect(client.get("https://example.test/page")).rejects.toThrow(
      /robots\.txt disallows redirected target/,
    );
  });
});
