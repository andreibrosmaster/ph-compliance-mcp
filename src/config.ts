/**
 * Runtime configuration (blueprint §6, §3). Everything is overridable via env
 * so the server is portable and CI-testable without touching GitHub Releases.
 * Env prefix: PH_COMPLIANCE_ (renamed from PH_LEGAL_ at 0.6.0 — see ADR-004).
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const EnvSchema = z.object({
  /** Where downloaded corpus assets and checksums are cached. */
  PH_COMPLIANCE_CACHE_DIR: z.string().optional(),
  /** Base URL for corpus Release assets. Defaults to the GitHub latest release. */
  PH_COMPLIANCE_RELEASE_URL: z.string().optional(),
  /** Owner/repo for the GitHub distribution, e.g. "nicene-software/ph-compliance-mcp". */
  PH_COMPLIANCE_REPO: z.string().default("nicene-software/ph-compliance-mcp"),
  /** Optional local override dir containing laws/cases/issuances sqlite + .sha256. */
  PH_COMPLIANCE_LOCAL_CORPUS: z.string().optional(),
  /** Confidence gate for retrieval tools (0..1). */
  PH_COMPLIANCE_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.4),
  PH_COMPLIANCE_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export interface Config {
  cacheDir: string;
  releaseUrl: string;
  repo: string;
  localCorpusDir?: string;
  confidenceThreshold: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

export const SERVER_NAME = "ph-compliance";
export const SERVER_VERSION = "0.10.0";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.parse(env);
  const cacheDir = parsed.PH_COMPLIANCE_CACHE_DIR ?? join(homedir(), ".cache", "ph-compliance-mcp");
  const releaseUrl =
    parsed.PH_COMPLIANCE_RELEASE_URL ??
    `https://github.com/${parsed.PH_COMPLIANCE_REPO}/releases/latest/download`;

  return {
    cacheDir,
    releaseUrl,
    repo: parsed.PH_COMPLIANCE_REPO,
    localCorpusDir: parsed.PH_COMPLIANCE_LOCAL_CORPUS,
    confidenceThreshold: parsed.PH_COMPLIANCE_CONFIDENCE_THRESHOLD,
    logLevel: parsed.PH_COMPLIANCE_LOG_LEVEL,
  };
}

/** The three corpus file names (ADR-003). */
export const CORPUS_ASSETS = ["laws", "cases", "issuances"] as const;
export type CorpusName = (typeof CORPUS_ASSETS)[number];
