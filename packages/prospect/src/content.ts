import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { templateContentDir } from "./paths.js";
import { VERIFY_MARKER } from "./project.js";
import type { SiteConfig } from "./site-config.js";

/**
 * The template's content collections, for a prospect that has none.
 *
 * `about.astro` and `services.astro` resolve every page against
 * `src/content/<collection>/<slug>/…` and throw when a file is missing — by
 * design, so a service can never render blank. A generated demo therefore
 * needs those files to exist before `astro build` runs.
 *
 * They are written as **build-time temporaries and removed afterwards**. Two
 * reasons, both firm:
 *
 *  1. `packages/template` belongs to another stream. Leaving generated files
 *     in its tree would be writing into someone else's directory, and the
 *     grant for this work does not cover that.
 *  2. The prose is derived from a third party's business data, which
 *     CLAUDE.md forbids committing. `prospects/` is gitignored; the template's
 *     content directory is not.
 *
 * A file that already exists is never touched, so the five hand-authored
 * clients build from the prose a person wrote for them and this module does
 * nothing at all.
 */

export interface ContentHandle {
  /** Files this run created. Empty when the prospect already had content. */
  created: string[];
  /** Files that were already there and were left alone. */
  reused: string[];
  /** Removes exactly what was created, and nothing else. */
  cleanup: () => void;
}

function frontmatter(fields: Record<string, string | string[]>): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${JSON.stringify(item)}`);
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

/**
 * Prose for a business whose story nobody has told us.
 *
 * It states what a source gave us and then says, in the open, that the rest is
 * theirs to fill in — carrying the template's marker so the build cannot go
 * indexable while the sentence is still there. It does not invent a founding
 * story, a family, or a workshop.
 */
function aboutBody(site: SiteConfig): string {
  const place = [site.business.address.locality, site.business.address.region]
    .filter(Boolean)
    .join(", ");
  const services = site.services.map((s) => s.title.toLowerCase());
  const listed =
    services.length > 1
      ? `${services.slice(0, -1).join(", ")} and ${services[services.length - 1]}`
      : (services[0] ?? "the work");

  const opening = place
    ? `${site.business.name} works out of ${place}.`
    : `${site.business.name}.`;
  const trade = `The shop takes on ${listed}.`;
  const founded = site.business.foundedYear
    ? ` It has been trading since ${site.business.foundedYear}.`
    : "";

  return [
    `${opening} ${trade}${founded}`,
    "",
    `This page is where the rest of the story goes — how the business started, who runs it now, and the jobs it is known for. ${VERIFY_MARKER}: we have not been told any of that yet, and would rather leave the space open than write it for you.`,
    "",
  ].join("\n");
}

function serviceBody(title: string, site: SiteConfig): string {
  const place = site.business.address.locality;
  return [
    `${title} from ${site.business.name}${place ? ` in ${place}` : ""}.`,
    "",
    `Tell us about the job — what it is, what it is made of, and when you need it — and we will come back to you with what it takes and what it costs.`,
    "",
  ].join("\n");
}

export function ensureContent(slug: string, site: SiteConfig, aboutEntry = "about"): ContentHandle {
  const created: string[] = [];
  const reused: string[] = [];
  const createdDirs: string[] = [];

  const write = (file: string, body: string): void => {
    if (existsSync(file)) {
      reused.push(file);
      return;
    }
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, body, "utf8");
    created.push(file);
  };

  const aboutDir = join(templateContentDir, "about", slug);
  const servicesDir = join(templateContentDir, "services", slug);
  if (!existsSync(aboutDir)) createdDirs.push(aboutDir);
  if (!existsSync(servicesDir)) createdDirs.push(servicesDir);

  write(
    join(aboutDir, `${aboutEntry}.md`),
    frontmatter({ title: `About ${site.business.name}` }) + aboutBody(site),
  );

  for (const service of site.services) {
    write(
      join(servicesDir, `${service.slug}.md`),
      frontmatter({
        title: service.title,
        summary: service.oneLiner,
        highlights: [
          `Ask us about ${service.title.toLowerCase()} — we will tell you what the job takes.`,
        ],
      }) + serviceBody(service.title, site),
    );
  }

  return {
    created,
    reused,
    cleanup: () => {
      for (const file of created) rmSync(file, { force: true });
      // Only remove a directory this run brought into existence, and only when
      // it is empty — a directory that still holds someone's markdown is not
      // ours to delete.
      for (const dir of createdDirs) {
        try {
          if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
        } catch {
          /* leaving an empty directory behind is harmless */
        }
      }
    },
  };
}
