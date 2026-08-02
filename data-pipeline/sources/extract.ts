/**
 * Shared HTML→text extraction for source adapters (production-readiness push,
 * 0.7.0). Official sources are HTML; adapters reduce them to plain text here so
 * the downstream normalizers only ever see text. CI-only — never imported by
 * the runtime server.
 *
 * Selector lists are per-source best-effort: Official Gazette wraps the article
 * body in `.entry-content`; LawPhil is table-based and the text usually lands
 * in `.post_content` / the main table cell.
 */
import * as cheerio from "cheerio";
import { normalizeWhitespace } from "../normalizers/statute-normalizer.js";

export interface ExtractedArticle {
  title?: string;
  text: string;
}

/** Official Gazette body selectors, best first. */
export const OG_SELECTORS = [
  "article.entry-content",
  ".entry-content",
  ".post-content",
  "article",
  "#content",
  ".content",
];

/** LawPhil body selectors, best first. */
export const LAWPHIL_SELECTORS = [".post_content", ".node-body", "td[valign='top']", "td", "body"];

/** Minimum body length before a page is treated as content (vs nav/footer
 * fragments). Shared by extractArticle and the adapters' thin-page skip. */
export const MIN_TEXT_LENGTH = 120;

/**
 * Extract a title + body from an HTML document. Returns the first selector
 * whose text exceeds a length floor (nav/menu fragments are short), falling
 * back to the whole body. `title` comes from the first H1-like heading.
 */
export function extractArticle(html: string, selectors: string[]): ExtractedArticle {
  const $ = cheerio.load(html);
  const title = $("h1.entry-title, h1.title, h1.post-title, h1").first().text().trim();

  let text = "";
  for (const sel of selectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    const t = el.text() ?? "";
    if (t.trim().length >= MIN_TEXT_LENGTH) {
      text = t;
      break;
    }
  }
  if (!text.trim()) text = $("body").text() ?? "";

  return { title: title || undefined, text: normalizeWhitespace(text) };
}
