#!/usr/bin/env bash
#
# Demonstrates every rule in check-headers.mjs failing.
#
# CLAUDE.md requires a new gate to land with its failure demonstrated first.
# Unlike the injection demo, this one mutates nothing tracked: it copies a built
# client to a scratch slug under dist/, tampers with the copy's _headers, and
# deletes it afterwards. dist/ is a build artifact, so nothing here can damage
# source.
#
#   bash scripts/demo/header-failures.sh > ../../docs/evidence/trust-seo/check-headers-failures.txt 2>&1
#
# Run from packages/template, after a build.
set -u

cd "$(dirname "$0")/../.." || exit 1

SRC=dist/kh-machine-works
TMP=dist/zz-headers-demo

if [ ! -f "$SRC/_headers" ]; then
  echo "REFUSING: $SRC/_headers not found. Build kh-machine-works first." >&2
  exit 1
fi

reset () { rm -rf "$TMP"; cp -r "$SRC" "$TMP"; }
run () { node scripts/check-headers.mjs zz-headers-demo; echo "exit=$?"; }
trap 'rm -rf "$TMP"' EXIT

cat <<'PREAMBLE'
check-headers.mjs — every rule demonstrated failing before the gate landed.

The gate has two jobs: catch a _headers file that has drifted from the pages it
covers, and enforce the standing invariants that measurement must never be able
to weaken. Both are exercised below.

PREAMBLE

reset
echo "--- baseline (untampered copy) ---"; run; echo

echo "--- no _headers at all ---"
reset; rm "$TMP/_headers"
run; echo

echo "--- script-src gains 'unsafe-inline' (the assertion this gate exists for) ---"
reset; sed -i "s|script-src 'self'|script-src 'self' 'unsafe-inline'|" "$TMP/_headers"
run; echo

echo "--- script-src gains 'unsafe-eval' ---"
reset; sed -i "s|script-src 'self'|script-src 'self' 'unsafe-eval'|" "$TMP/_headers"
run; echo

echo "--- a script hash goes stale (page changed, headers did not) ---"
reset; sed -i "s|'sha256-|'sha256-XX|" "$TMP/_headers"
run; echo

echo "--- frame-ancestors weakened from 'none' ---"
reset; sed -i "s|frame-ancestors 'none'|frame-ancestors 'self'|" "$TMP/_headers"
run; echo

echo "--- nosniff removed ---"
reset; sed -i "/X-Content-Type-Options/d" "$TMP/_headers"
run; echo

echo "--- Permissions-Policy stops denying geolocation ---"
reset; sed -i "s|geolocation=(), ||" "$TMP/_headers"
run; echo

echo "--- an origin allowlisted that the pages never reference ---"
reset; sed -i "s|connect-src 'self'|connect-src 'self' https://evil.example|" "$TMP/_headers"
run; echo

echo "--- the /* block is narrowed so most paths are uncovered ---"
reset; sed -i "s|^/\*$|/index.html|" "$TMP/_headers"
run
