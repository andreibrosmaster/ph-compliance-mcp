/**
 * Polite HTTP client for ingestion (blueprint §7 + §17).
 *
 * - Descriptive User-Agent
 * - Conditional GETs (ETag / Last-Modified) with an on-disk cache; a 304
 *   revalidates and returns cached bytes (doubles as change detection).
 * - robots.txt respected with RFC 9309 semantics: unreachable, 401/403, and
 *   5xx (after retries) robots.txt mean FULL DISALLOW, not allow-all; redirect
 *   targets are re-checked (see robots.ts)
 * - Low concurrency + minimum inter-request delay
 *
 * CI-only usage; never imported by the runtime server.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseRobots, rulesForAgent, isPathAllowed } from "./robots.js";

export interface HttpClientOptions {
  userAgent: string;
  /** Directory for the conditional-GET cache manifest. */
  cacheDir: string;
  /** Minimum delay between requests, ms. */
  minDelayMs?: number;
  /** Max concurrent in-flight requests. */
  maxConcurrency?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface FetchResult {
  url: string;
  status: number;
  /** Body bytes (from network or cache after revalidation). */
  bytes: Buffer;
  text: string;
  etag?: string;
  lastModified?: string;
  fromCache: boolean;
  contentHash: string;
}

interface CacheEntry {
  url: string;
  etag?: string;
  lastModified?: string;
  bodyB64?: string; // present when we cache bodies locally
}

export class HttpClient {
  readonly options: Required<Omit<HttpClientOptions, never>>;
  /** Per-origin robots rules, or "disallow-all" when robots.txt is unreachable/forbidden. */
  private robotsCache = new Map<string, ReturnType<typeof parseRobots> | "disallow-all">();
  private lastRequestAt = 0;
  private inFlight = 0;
  private queue: Array<() => void> = [];

  constructor(opts: HttpClientOptions) {
    this.options = {
      minDelayMs: opts.minDelayMs ?? 500,
      maxConcurrency: opts.maxConcurrency ?? 2,
      timeoutMs: opts.timeoutMs ?? 30_000,
      maxRetries: opts.maxRetries ?? 3,
      ...opts,
    };
  }

  /** Acquire a concurrency slot. */
  private async acquire(): Promise<void> {
    if (this.inFlight < this.options.maxConcurrency) {
      this.inFlight++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.inFlight++;
  }

  private release(): void {
    this.inFlight--;
    const next = this.queue.shift();
    if (next) next();
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.lastRequestAt + this.options.minDelayMs - now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  /**
   * Fetch robots.txt for an origin and cache the parsed rules in memory.
   *
   * RFC 9309 §2.4.2.1 discipline — fail CLOSED:
   * - 2xx: parse the rules.
   * - 401/403 (or unreachable after retries): complete disallow. Crawling an
   *   origin whose robots.txt we cannot read is exactly how a polite crawler
   *   becomes an abusive one; a transient 5xx previously flipped this client
   *   into allow-all and crawled anyway.
   * - other 4xx: allow all (per RFC), empty rules.
   */
  async checkRobots(url: string): Promise<boolean> {
    const u = new URL(url);
    const origin = `${u.protocol}//${u.host}`;
    let rules = this.robotsCache.get(origin);
    if (rules === undefined) {
      rules = await this.fetchRobots(origin);
      this.robotsCache.set(origin, rules);
    }
    if (rules === "disallow-all") return false;
    return isPathAllowed(rulesForAgent(rules, this.options.userAgent), u.pathname);
  }

  private async fetchRobots(
    origin: string,
  ): Promise<ReturnType<typeof parseRobots> | "disallow-all"> {
    const url = `${origin}/robots.txt`;
    let lastErr: unknown = new Error("not attempted");
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const { res, cancelTimer } = await this.fetchWithTimeout(url, {});
        try {
          if (res.ok) {
            return parseRobots(await res.text());
          }
          // Release the socket before retrying or concluding.
          await res.body?.cancel().catch(() => undefined);
          if (res.status === 401 || res.status === 403) return "disallow-all";
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            return parseRobots(""); // RFC 9309: other 4xx → allow all
          }
          lastErr = new Error(`HTTP ${res.status}`); // 429/5xx: retry
        } finally {
          cancelTimer();
        }
      } catch (err) {
        lastErr = err;
      }
      if (attempt < this.options.maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
    process.stderr.write(
      `[http-client] robots.txt unreachable for ${origin} (${lastErr instanceof Error ? lastErr.message : String(lastErr)}) — treating as full disallow (RFC 9309).\n`,
    );
    return "disallow-all";
  }

  /** Fetch a URL with conditional-GET caching. Throws on disallowed by robots. */
  async get(url: string): Promise<FetchResult> {
    const allowed = await this.checkRobots(url);
    if (!allowed) {
      throw new Error(`robots.txt disallows fetching: ${url}`);
    }
    await this.acquire();
    try {
      await this.throttle();
      return await this.getWithRetry(url);
    } finally {
      this.release();
    }
  }

  private async getWithRetry(url: string, attempt = 0): Promise<FetchResult> {
    const cached = await this.readCache(url);
    const headers: Record<string, string> = {};
    if (cached?.etag) headers["If-None-Match"] = cached.etag;
    if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;

    const { res, cancelTimer } = await this.fetchWithTimeout(url, headers);
    try {
      // 304: revalidated — serve cached body if we have one; otherwise fail loudly.
      if (res.status === 304) {
        if (cached?.bodyB64) {
          const bytes = Buffer.from(cached.bodyB64, "base64");
          return {
            url,
            status: 304,
            bytes,
            text: bytes.toString("utf8"),
            etag: cached.etag,
            lastModified: cached.lastModified,
            fromCache: true,
            contentHash: sha256(bytes),
          };
        }
        throw new Error(`HTTP 304 without cached body for ${url}`);
      }
      if (res.status === 429 || res.status >= 500) {
        // Release the socket before retrying.
        await res.body?.cancel().catch(() => undefined);
        if (attempt < this.options.maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          return this.getWithRetry(url, attempt + 1);
        }
      }
      if (res.status < 200 || res.status >= 300) {
        // Release the socket before throwing — an abandoned body keeps the
        // libuv handle open and can crash process.exit() on Windows.
        await res.body?.cancel().catch(() => undefined);
        throw new Error(`HTTP ${res.status} fetching ${url}`);
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      const etag = res.headers.get("etag") ?? undefined;
      const lastModified = res.headers.get("last-modified") ?? undefined;
      // Redirects: fetch follows them silently, but robots.txt is evaluated
      // per-target. If the FINAL URL's robots disallow it, the content must
      // not be used even though the original URL was allowed.
      if (res.url && res.url !== url && !(await this.checkRobots(res.url))) {
        throw new Error(`robots.txt disallows redirected target: ${res.url}`);
      }
      await this.writeCache(url, etag, lastModified, bytes);
      return {
        url,
        status: res.status,
        bytes,
        text: bytes.toString("utf8"),
        etag,
        lastModified,
        fromCache: false,
        contentHash: sha256(bytes),
      };
    } finally {
      cancelTimer();
    }
  }

  /**
   * Fetch with a timeout that stays armed until the CALLER consumes the body
   * (headers-only timeouts would let a stalled body hang the crawler forever).
   * Returns the Response plus a cancelTimer() the caller must invoke in a
   * finally block once the body is read or the request is abandoned.
   */
  private async fetchWithTimeout(
    url: string,
    headers: Record<string, string>,
  ): Promise<{ res: Response; cancelTimer: () => void }> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.options.timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": this.options.userAgent, ...headers },
        signal: ac.signal,
        redirect: "follow",
      });
      return { res, cancelTimer: () => clearTimeout(timer) };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  private cachePath(url: string): string {
    return join(this.options.cacheDir, sha256(url) + ".json");
  }

  private async readCache(url: string): Promise<CacheEntry | undefined> {
    try {
      const raw = await readFile(this.cachePath(url), "utf8");
      return JSON.parse(raw) as CacheEntry;
    } catch {
      return undefined;
    }
  }

  private async writeCache(
    url: string,
    etag: string | undefined,
    lastModified: string | undefined,
    body: Buffer,
  ): Promise<void> {
    const entry: CacheEntry = {
      url,
      etag,
      lastModified,
      bodyB64: body.toString("base64"),
    };
    await mkdir(dirname(this.cachePath(url)), { recursive: true });
    await writeFile(this.cachePath(url), JSON.stringify(entry), "utf8");
  }
}

export function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}
