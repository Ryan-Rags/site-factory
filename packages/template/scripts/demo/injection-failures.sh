#!/usr/bin/env bash
#
# Demonstrates every rule in check-injection.mjs failing.
#
# CLAUDE.md requires a new gate to land with its failure demonstrated first.
# This is that demonstration, kept as a script rather than a pasted transcript
# so anyone can re-run it and get the same output — a gate whose failure mode
# was proved once, by hand, on a machine nobody else has, is a gate you are
# taking on trust.
#
# Each rule is triggered by a real mutation of real source, the gate is run, and
# the mutation is reverted immediately. The final block re-runs on the restored
# tree to prove nothing was left behind.
#
#   bash scripts/demo/injection-failures.sh > ../../docs/evidence/trust-seo/check-injection-failures.txt 2>&1
#
# Run from packages/template. Requires a clean working tree.
set -u

cd "$(dirname "$0")/../.." || exit 1
REPO=../..

# Only *tracked* modifications matter: the revert below is `git checkout --`,
# which would discard them. Untracked files are not at risk and are the normal
# state while this stream's own new scripts are still unstaged, so refusing on
# those would make the demo unrunnable exactly when it is being written.
DIRTY=$(git -C "$REPO" diff --name-only -- packages/template
        git -C "$REPO" diff --cached --name-only -- packages/template)
if [ -n "$DIRTY" ]; then
  echo "REFUSING: packages/template has uncommitted changes to tracked files:" >&2
  echo "$DIRTY" >&2
  echo "This script mutates tracked source and reverts with git checkout, which" >&2
  echo "would destroy that work. Commit it first." >&2
  exit 1
fi

revert () { git -C "$REPO" checkout -- "packages/template/$1"; }

run () { node scripts/check-injection.mjs; echo "exit=$?"; }

cat <<'PREAMBLE'
check-injection.mjs — every rule demonstrated failing before the gate landed.

NOTE ON RULE 5: the first pass of this demo reported GREEN on a planted ?ref
parameter. The binder regex required var|let|const immediately before the
identifier, and DesignLayout's no-flash script declares

    var d=document.documentElement,q=new URLSearchParams(location.search),s={};

where q is the second declarator in a comma list. The gate was therefore blind
to the only file that reads query parameters at all — a fail-open on the exact
surface rule 5 exists to bound. It was widened to match any assignment from
`new URLSearchParams(…)`, and a companion rule now fails closed when a file
reads location.search in a shape the gate cannot follow. Both are demonstrated
below.

PREAMBLE

echo "--- baseline (clean tree) ---"; run; echo

echo "--- rule 1: banned-sink ---"
printf '\nconst leak = (el, s) => { el.innerHTML = s; };\n' >> src/lib/business.ts
run; revert src/lib/business.ts; echo

echo "--- rule 2: unreviewed-interpolation (expression changed) ---"
sed -i 's|set:html={JSON.stringify(faqJsonLd)}|set:html={JSON.stringify(faqJsonLd) + globalThis.extra}|' \
  src/components/LocalBusinessJsonLd.astro
run; revert src/components/LocalBusinessJsonLd.astro; echo

echo "--- rule 3: not-static / adapter-present ---"
sed -i "s|output: 'static',|output: 'server',\n  adapter: someAdapter(),|" astro.config.mjs
run; revert astro.config.mjs; echo

echo "--- rule 4: request-reflection ---"
sed -i 's|const { business, brand, seo } = site;|const { business, brand, seo } = site;\nconst ref = Astro.request.headers.get("referer");|' \
  src/components/LocalBusinessJsonLd.astro
run; revert src/components/LocalBusinessJsonLd.astro; echo

echo "--- rule 5: unbounded-query-param (the rule that first failed open) ---"
sed -i "s|var t=q.get('theme')|var ref=q.get('ref');var t=q.get('theme')|" \
  src/components/design/DesignLayout.astro
run; revert src/components/design/DesignLayout.astro; echo

echo "--- rule 5b: the widened trigger now sees new URL(...).searchParams ---"
# This mutation is the second fail-open the demo caught. Rule 5 used to engage
# only on the literal text `location.search`, so rewriting the binder this way
# made the gate skip the file in silence. It is now both triggered and bound.
sed -i "s|q=new URLSearchParams(location.search)|q=new URL(location.href).searchParams|" \
  src/components/design/DesignLayout.astro
sed -i "s|var t=q.get('theme')|var ref=q.get('ref');var t=q.get('theme')|" \
  src/components/design/DesignLayout.astro
run; revert src/components/design/DesignLayout.astro; echo

echo "--- rule 5c: unbounded direct read, never bound to a name ---"
# `new URLSearchParams(...).get('ref')` binds nothing, so there is no name for
# the bound-read check to follow. An earlier draft treated the assignment target
# as a params object and went green with this exact mutation in place.
sed -i "s|var t=q.get('theme')|var t=new URLSearchParams(location.search).get('ref')\|\|q.get('theme')|" \
  src/components/design/DesignLayout.astro
run; revert src/components/design/DesignLayout.astro; echo

echo "--- rule 5d: unreadable-param-surface (query reached through a helper) ---"
sed -i "s|q=new URLSearchParams(location.search)|q=makeParams(location.search)|" \
  src/components/design/DesignLayout.astro
run; revert src/components/design/DesignLayout.astro; echo

echo "--- restored: gate green again ---"; run
