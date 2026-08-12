/**
 * Small source-reading helpers shared by the security gates.
 *
 * Deliberately not a parser. These gates are grep-level by design — see
 * `docs/injection-surface.md` for what that can and cannot prove, and for the
 * runtime checks that cover the rest. What lives here is the minimum needed to
 * stop a grep from being *wrong*: finding the end of a JSX expression, and not
 * reporting a hit that sits in a comment.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every file under `dir` whose name matches `extRe`, recursively. */
export function walkSource(dir, extRe) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkSource(full, extRe));
    else if (extRe.test(name)) out.push(full);
  }
  return out.sort();
}

/**
 * Lines that are wholly a comment, by their opening token.
 *
 * A heuristic, and a deliberately conservative one: it only ever *suppresses*
 * a hit, and only when the line begins with a comment marker. `el.innerHTML =
 * "/* not a comment *\/"` is not suppressed, because the line begins with
 * `el.`. The dominant comment style in this package is the JSDoc block, whose
 * continuation lines begin with `*`, which is why that form is included.
 */
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*(?!\/)|\*\/|\{\/\*|<!--)/;

export function isCommentLine(line) {
  return COMMENT_LINE.test(line);
}

/**
 * The index just past the `}` that closes the `{` at `open`.
 *
 * String-aware, because the expressions this is pointed at contain both CSS
 * braces and `${}` interpolation — `BaseLayout.astro`'s token block is a
 * template literal full of both. Counting braces naively would stop in the
 * middle of it and hash a fragment, which would make the manifest in
 * `check-injection.mjs` fail open on exactly the file most worth watching.
 *
 * Returns -1 if the braces never balance, which the caller must treat as a
 * failure rather than as an empty expression.
 */
export function matchBraces(text, open) {
  if (text[open] !== '{') throw new Error(`matchBraces: index ${open} is not '{'`);

  let depth = 0;
  let i = open;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '\\') {
      i += 2;
      continue;
    }

    if (ch === "'" || ch === '"') {
      i = skipQuoted(text, i, ch);
      continue;
    }

    if (ch === '`') {
      // `skipTemplate` recurses back through `matchBraces` for each `${…}`, so
      // interpolation braces are consumed there and never reach `depth`.
      i = skipTemplate(text, i);
      continue;
    }

    if (ch === '/' && next === '/') {
      const nl = text.indexOf('\n', i);
      i = nl === -1 ? text.length : nl + 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }

    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }

    i += 1;
  }

  return -1;
}

function skipQuoted(text, start, quote) {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === '\\') i += 2;
    else if (text[i] === quote) return i + 1;
    else if (text[i] === '\n') return i; // Unterminated: do not run to EOF.
    else i += 1;
  }
  return i;
}

/**
 * Skip a template literal, recursing through `${…}` interpolations so that a
 * brace inside one — or a nested template inside that — cannot be mistaken for
 * the brace that closes the expression being measured.
 */
function skipTemplate(text, start) {
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '`') return i + 1;
    if (ch === '$' && text[i + 1] === '{') {
      const end = matchBraces(text, i + 1);
      if (end === -1) return text.length;
      i = end;
      continue;
    }
    i += 1;
  }
  return i;
}

/** 1-based line number of a character offset. */
export function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) if (text[i] === '\n') line += 1;
  return line;
}
