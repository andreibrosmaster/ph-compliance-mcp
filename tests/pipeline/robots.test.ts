import { describe, expect, it } from "vitest";
import { parseRobots, rulesForAgent, isPathAllowed } from "../../data-pipeline/robots.js";

const SAMPLE = `
User-agent: *
Disallow: /search
Disallow: /api/

User-agent: ph-compliance-mcp-bot
Disallow: /private
`;

describe("robots parser", () => {
  it("parses per-agent disallows", () => {
    const perAgent = parseRobots(SAMPLE);
    expect(perAgent.get("*")).toEqual(["/search", "/api/"]);
    expect(perAgent.get("ph-compliance-mcp-bot")).toEqual(["/private"]);
  });

  it("specific agent rules override wildcard", () => {
    const perAgent = parseRobots(SAMPLE);
    const botRules = rulesForAgent(perAgent, "ph-compliance-mcp-bot/0.1");
    expect(botRules.disallows).toEqual(["/private"]);
    expect(isPathAllowed(botRules, "/search/foo")).toBe(true);
    expect(isPathAllowed(botRules, "/private/x")).toBe(false);
  });

  it("falls back to wildcard rules for unknown agents", () => {
    const perAgent = parseRobots(SAMPLE);
    const generic = rulesForAgent(perAgent, "some-other-bot");
    expect(generic.disallows).toEqual(["/search", "/api/"]);
    expect(isPathAllowed(generic, "/search/x")).toBe(false);
    expect(isPathAllowed(generic, "/articles")).toBe(true);
  });

  it("allow-all when no disallow rules", () => {
    const perAgent = parseRobots("User-agent: *\nAllow: /everything\n");
    const rules = rulesForAgent(perAgent, "x");
    expect(rules.allowAll).toBe(true);
  });

  it("handles comments and blank lines", () => {
    const perAgent = parseRobots("# comment\n\nUser-agent: *\n# Disallow: /ignored\n");
    expect(perAgent.get("*")).toEqual([]);
  });
});
