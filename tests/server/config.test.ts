import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  it("applies defaults", () => {
    const cfg = loadConfig({});
    expect(cfg.repo).toBe("nicene-software/ph-compliance-mcp");
    expect(cfg.confidenceThreshold).toBe(0.4);
    expect(cfg.logLevel).toBe("info");
  });

  it("reads env overrides", () => {
    const cfg = loadConfig({
      PH_COMPLIANCE_REPO: "me/ph-compliance-mcp",
      PH_COMPLIANCE_CONFIDENCE_THRESHOLD: "0.55",
      PH_COMPLIANCE_LOG_LEVEL: "debug",
    });
    expect(cfg.repo).toBe("me/ph-compliance-mcp");
    expect(cfg.confidenceThreshold).toBe(0.55);
    expect(cfg.logLevel).toBe("debug");
  });

  it("builds a GitHub latest-release URL from repo", () => {
    const cfg = loadConfig({ PH_COMPLIANCE_REPO: "me/ph-compliance-mcp" });
    expect(cfg.releaseUrl).toBe("https://github.com/me/ph-compliance-mcp/releases/latest/download");
  });
});
