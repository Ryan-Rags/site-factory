import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";

import { templateClientsDir, templateDir } from "../paths.js";
import type { SiteConfig } from "../site-config.js";

/**
 * Read a hand-authored client config as an ingestion source.
 *
 * The five configs in `packages/template/clients/` are the most reliable data
 * we hold on those businesses: every value in them was researched and carries
 * its provenance inline. Ignoring them and re-ingesting from scratch would
 * produce a *worse* demo than the one that already exists — so they are read
 * as the top-precedence `manual` source, and never written to.
 *
 * They are TypeScript modules, and this is a plain Node process. Rather than
 * add a TS loader to the runtime, the config and the one module it imports at
 * runtime (`src/types/site.ts`, for `VERIFY_MARKER`) are transpiled into a
 * throwaway directory and imported from there. Transpile-only: no type
 * checking, no program, no Astro. The configs are type-checked by
 * `pnpm -r typecheck` in their own package, which is where that belongs.
 */

/** The one intra-template import a client config is allowed to make. */
const SITE_TYPES_SPECIFIER = "../src/types/site";

function transpile(source: string, fileName: string): string {
  const out = ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });
  return out.outputText;
}

/**
 * Node's ESM resolver needs a file extension. Rewrite the single known
 * specifier and refuse anything else, loudly — a config that grew a second
 * runtime import is a change this loader must be told about rather than one
 * it should paper over.
 */
function rewriteImports(js: string, slug: string): string {
  const rewritten = js.replace(
    new RegExp(`(['"])${SITE_TYPES_SPECIFIER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`, "g"),
    `'${SITE_TYPES_SPECIFIER}.mjs'`,
  );
  const remaining = [...rewritten.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)]
    .map((m) => m[1] ?? "")
    .filter((spec) => !spec.endsWith(".mjs"));
  if (remaining.length > 0) {
    throw new Error(
      `clients/${slug}.config.ts imports ${remaining.join(", ")} at runtime, which this loader ` +
        `does not know how to resolve. Teach packages/prospect/src/ingest/seed.ts about it.`,
    );
  }
  return rewritten;
}

export function clientConfigPath(slug: string): string {
  return join(templateClientsDir, `${slug}.config.ts`);
}

export function hasClientConfig(slug: string): boolean {
  return existsSync(clientConfigPath(slug));
}

/**
 * Load `clients/<slug>.config.ts` as data. Returns null when there is no such
 * config, which is the normal case for a brand-new prospect.
 */
export async function loadClientConfig(slug: string): Promise<SiteConfig | null> {
  const configFile = clientConfigPath(slug);
  if (!existsSync(configFile)) return null;

  const temp = mkdtempSync(join(tmpdir(), `site-factory-seed-${slug}-`));
  try {
    const typesOut = join(temp, "src", "types", "site.mjs");
    mkdirSync(dirname(typesOut), { recursive: true });
    const typesSource = readFileSync(join(templateDir, "src", "types", "site.ts"), "utf8");
    writeFileSync(typesOut, transpile(typesSource, "site.ts"), "utf8");

    const configOut = join(temp, "clients", `${slug}.config.mjs`);
    mkdirSync(dirname(configOut), { recursive: true });
    const configJs = rewriteImports(transpile(readFileSync(configFile, "utf8"), `${slug}.config.ts`), slug);
    writeFileSync(configOut, configJs, "utf8");

    const mod = (await import(pathToFileURL(configOut).href)) as {
      site?: SiteConfig;
      default?: SiteConfig;
    };
    const site = mod.site ?? mod.default;
    if (!site) throw new Error(`clients/${slug}.config.ts exported no site config`);
    return site;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
