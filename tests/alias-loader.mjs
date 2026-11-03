// Lets `node --test` run the TypeScript lib files directly: maps "@/x" to
// ./src/x.ts (Node strips the types itself). No extra dependencies.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const src = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = fileURLToPath(new URL(specifier.slice(2), src));
    for (const cand of [base + ".ts", base + ".tsx", base + "/index.ts"]) {
      if (existsSync(cand)) return next(pathToFileURL(cand).href, context);
    }
  }
  return next(specifier, context);
}

if (!globalThis.__aliasRegistered) {
  globalThis.__aliasRegistered = true;
  register(import.meta.url);
}
