import { existsSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";

import { copyDistEntry, templateClientsDir, templateDir } from "../paths.js";
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
 * add a TS loader to the runtime, the config and everything it imports are
 * transpiled into a throwaway directory mirroring the template's layout and
 * imported from there. Transpile-only: no type checking, no program, no Astro.
 * The configs are type-checked by `pnpm -r typecheck` in their own package,
 * which is where that belongs. See `stageModule` for how the graph is walked.
 */

/**
 * The one bare specifier a client config may reach for.
 *
 * Everything else it imports has to be a relative path inside the template,
 * which is a property worth keeping: a config that reached into a third
 * package would be a config whose data came from somewhere this loader cannot
 * account for.
 */
const COPY_PACKAGE = "@site-factory/copy";

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
 * Candidate files a relative specifier can mean, in Node/TS resolution order.
 *
 * `isFile()` rather than `existsSync()`: `./design` names both a directory and
 * the `design/index.ts` inside it, and the bare directory matches first.
 */
function resolveLocal(fromFile: string, spec: string): string | null {
  const base = resolvePath(dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.mjs`,
    `${base}.json`,
    join(base, "index.ts"),
    join(base, "index.mjs"),
  ];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

/**
 * Transpile a client config and everything it imports into a throwaway tree.
 *
 * The configs are TypeScript and this is a plain Node process, so each module
 * in the graph is transpiled (no type checking, no program, no Astro) into a
 * temp directory that mirrors the template's own layout — which is what keeps
 * every relative specifier inside the graph valid without rewriting paths.
 *
 * It walks the graph rather than knowing one specifier because the graph grew.
 * Every hand-authored config now composes `./from-copy` (the copy engine) and
 * `./design` (the design briefs), and those pull in `src/lib/design`,
 * `src/design/presets`, `presets.json` and `contrast.mjs`. The previous loader
 * knew about exactly one import and refused the rest, which meant that from the
 * moment the configs were rewritten to compose, `loadClientConfig()` threw for
 * all eight of them and the pipeline silently lost its best data source.
 *
 * Three file kinds, because Node needs them handled differently:
 *
 *   .ts    transpiled to `.mjs`, specifiers rewritten to the emitted names
 *   .mjs   copied verbatim — already plain ESM (`contrast.mjs`)
 *   .json  re-emitted as `<name>.json.mjs` with a default export, because a
 *          bare `import x from './y.json'` needs an import attribute in Node
 *          while Astro and Vite resolve it without one
 *
 * A bare specifier other than the copy package is still refused loudly. That
 * part of the original design was right: a config reaching somewhere this
 * loader cannot follow should stop the run, not be papered over.
 */
function stageModule(file: string, tempRoot: string, seen: Map<string, string>, slug: string): string {
  const cached = seen.get(file);
  if (cached !== undefined) return cached;

  const rel = relative(templateDir, file).split("\\").join("/");
  const isJson = file.endsWith(".json");
  const isMjs = file.endsWith(".mjs");
  const outRel = isJson ? `${rel}.mjs` : isMjs ? rel : rel.replace(/\.ts$/, ".mjs");
  const outFile = join(tempRoot, outRel);
  mkdirSync(dirname(outFile), { recursive: true });
  // Recorded before recursing, so an import cycle terminates instead of
  // rebuilding its way down forever.
  seen.set(file, outFile);

  if (isJson) {
    writeFileSync(outFile, `export default ${readFileSync(file, "utf8")};\n`, "utf8");
    return outFile;
  }
  if (isMjs) {
    copyFileSync(file, outFile);
    return outFile;
  }

  let js = transpile(readFileSync(file, "utf8"), file);

  // Rewrite every specifier this module keeps after transpilation, staging
  // whatever it points at first.
  js = js.replace(/(\bfrom\s*|\bimport\s*\(\s*)(['"])([^'"]+)\2/g, (_whole, lead: string, quote: string, spec: string) => {
    if (spec === COPY_PACKAGE) {
      return `${lead}${quote}${pathToFileURL(copyDistEntry).href}${quote}`;
    }
    if (!spec.startsWith(".")) {
      throw new Error(
        `clients/${slug}.config.ts (via ${rel}) imports "${spec}" at runtime, which this loader ` +
          `does not know how to resolve. Teach packages/prospect/src/ingest/seed.ts about it.`,
      );
    }
    const target = resolveLocal(file, spec);
    if (target === null) {
      throw new Error(
        `clients/${slug}.config.ts (via ${rel}) imports "${spec}", which does not resolve to a ` +
          `file under packages/template/.`,
      );
    }
    stageModule(target, tempRoot, seen, slug);
    // The temp tree mirrors the template's layout, so the author's own relative
    // path stays correct and only its extension needs fixing.
    return `${lead}${quote}${specifierFor(spec, target)}${quote}`;
  });

  writeFileSync(outFile, js, "utf8");
  return outFile;
}

/**
 * The emitted specifier for a resolved target: the author's own relative path
 * with the extension Node will actually find, including the `/index` a
 * directory import expands to.
 */
function specifierFor(spec: string, target: string): string {
  if (target.endsWith(".mjs")) return spec;
  if (target.endsWith(".json")) return `${spec}.mjs`;
  const bare = spec.replace(/\.ts$/, "");
  return target.endsWith(`index.ts`) && !bare.endsWith("index") ? `${bare}/index.mjs` : `${bare}.mjs`;
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
    const configOut = stageModule(configFile, temp, new Map(), slug);

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
