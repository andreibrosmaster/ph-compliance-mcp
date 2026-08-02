/**
 * Minimal robots.txt parser (blueprint §7 scraping discipline: robots.txt
 * respected). We only need Disallow rules per user-agent, applied to paths.
 */

export interface RobotsRules {
  /** Path prefixes disallowed for a given agent; a rule `*` applies to all. */
  disallows: string[];
  allowAll: boolean;
}

const WILDCARD = "*";

/** Parse robots.txt content into per-agent rule sets. */
export function parseRobots(content: string): Map<string, string[]> {
  const perAgent = new Map<string, string[]>();
  let currentAgent: string | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      currentAgent = value.toLowerCase();
      if (!perAgent.has(currentAgent)) perAgent.set(currentAgent, []);
    } else if (field === "disallow" && currentAgent) {
      // Empty Disallow means allow-all for this agent; ignore empty.
      if (value !== "") {
        perAgent.get(currentAgent)!.push(value);
      }
    }
  }
  return perAgent;
}

/** Compute the effective disallowed prefixes for a user agent. */
export function rulesForAgent(
  perAgent: Map<string, string[]>,
  userAgent: string,
): RobotsRules {
  const agent = userAgent.toLowerCase();
  // Specific agent rules take precedence over *; when several groups could
  // match, the LONGEST matching token wins (robots.txt spec). A crawler's UA
  // is "product/version", so match by prefix: "bot/1.0" matches the "bot"
  // group. Fall back to the wildcard group only when nothing specific matches.
  const wildcardRules = perAgent.get(WILDCARD) ?? [];
  let bestKey: string | null = null;
  for (const key of perAgent.keys()) {
    if (key === WILDCARD) continue;
    if (agent.startsWith(key) && (bestKey === null || key.length > bestKey.length)) {
      bestKey = key;
    }
  }
  const disallows = bestKey ? (perAgent.get(bestKey) ?? []) : wildcardRules;
  return { disallows, allowAll: disallows.length === 0 };
}

/** Is this URL path allowed given the effective rules? */
export function isPathAllowed(rules: RobotsRules, path: string): boolean {
  if (rules.allowAll) return true;
  return !rules.disallows.some((prefix) => path.startsWith(prefix));
}
