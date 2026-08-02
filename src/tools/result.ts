/**
 * Shared tool response helpers (mcp-builder skill: §2.3, best-practices
 * reference). Every tool returns BOTH a human-readable text rendering and the
 * same payload as `structuredContent` so clients can process it programmatically.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type ToolResult = CallToolResult;

/** Maximum characters for the text rendering; larger payloads get truncated. */
export const CHARACTER_LIMIT = 25_000;

/** Escape a value into a single-line JSON string for the text rendering. */
function render(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * Build a tool result with text content plus structuredContent (the modern SDK
 * pattern — see node_mcp_server.md). Both carry the same payload; structured
 * content is never truncated so clients get the full data.
 */
export function textResult(payload: unknown): ToolResult {
  const full = render(payload);
  const text = full.length > CHARACTER_LIMIT ? `${full.slice(0, CHARACTER_LIMIT)}\n… [truncated]` : full;
  return {
    content: [{ type: "text", text }],
    structuredContent: payload as Record<string, unknown>,
  };
}

/**
 * Truncate a large list payload before rendering, so a single tool response
 * cannot overwhelm the client's context (best-practices: pagination + limits).
 * `items` is the array to trim; `limit` was already enforced at the query level,
 * this is a defensive second gate.
 */
export function withCharacterLimit<T extends Record<string, unknown>>(
  payload: T,
  itemsKey: string,
): T {
  const items = payload[itemsKey];
  if (Array.isArray(items)) {
    const rendered = render(items);
    if (rendered.length > CHARACTER_LIMIT) {
      const trimmed = items.slice(0, 50) as unknown[];
      return {
        ...payload,
        [itemsKey]: trimmed,
        truncated: true,
        truncation_message:
          `Response truncated from ${items.length} to ${trimmed.length} items. ` +
          `Use a smaller limit or more specific query to see more results.`,
      } as T;
    }
  }
  return payload;
}
