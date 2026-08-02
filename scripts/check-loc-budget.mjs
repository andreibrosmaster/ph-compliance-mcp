#!/usr/bin/env node
/**
 * LOC budget guard (blueprint §6 / AGENTS.md rule 8).
 * Warns on modules >220 LOC, fails on modules >350 LOC.
 * Applies to src/ and data-pipeline/ TypeScript sources.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const WARN = 220;
const FLAG = 350;

/** Recursively collect .ts files under a dir (excluding tests). */
function collect(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(full, out);
    } else if (
      entry.isFile() &&
      extname(entry.name) === ".ts" &&
      !entry.name.endsWith(".test.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

const files = [...collect(join(root, "src")), ...collect(join(root, "data-pipeline"))];
let flagged = 0;

for (const file of files) {
  const loc = readFileSync(file, "utf8").split("\n").length;
  const rel = relative(root, file);
  if (loc > FLAG) {
    flagged++;
    console.error(`🔴 FLAG  ${rel}: ${loc} LOC (>${FLAG})`);
  } else if (loc > WARN) {
    console.warn(`🟡 warn  ${rel}: ${loc} LOC (>${WARN})`);
  }
}

if (flagged > 0) {
  console.error(`\n${flagged} module(s) over the hard LOC budget (${FLAG}). Split them.`);
  process.exit(1);
}
console.log("✅ LOC budget OK");
