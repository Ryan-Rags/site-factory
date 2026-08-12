import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  applyBackfill,
  histogram,
  planBackfill,
  renderBackfillPlan,
  renderHistogram,
  renderStatusTally,
  renderTop,
} from '../dist/index.js';

const LEAD_HEADER =
  'name,url,niche,city,phone,source,notes,place_id,rating,review_count,address,discovered_at';

const tmp = () => mkdtempSync(join(tmpdir(), 'shortlist-backfill-'));

const assessment = (over = {}) => ({
  result: {
    placeId: 'ChIJ_discovered',
    name: 'K-H Machine Works',
    nicheSlug: 'machine-shop',
    nicheLabel: 'machine shop',
    town: 'North Bergen',
    address: '',
    phone: '',
    website: '',
    types: [],
    rating: '',
    reviewCount: '',
    copyPack: 'machine-shop',
    seenIn: [],
    ...(over.result ?? {}),
  },
  identity: {
    how: 'slug-fallback',
    matchedIn: 'data/leads-machine.csv',
    matchedName: 'K-H Machine Works',
    warning: 'WARNING: ...',
    ...(over.identity ?? {}),
  },
  status: { status: 'none' },
  score: 80,
  reasons: [],
  ...over,
});

test('only slug-fallback matches are planned for backfill', () => {
  const plan = planBackfill([
    assessment(),
    assessment({ identity: { how: 'placeId', matchedIn: 'data/x.csv', matchedName: 'a' } }),
    assessment({ identity: { how: 'none', matchedIn: '', matchedName: '' } }),
  ]);
  assert.equal(plan.planned.length, 1);
});

test('a client-registry match is never backfilled into a CSV', () => {
  const plan = planBackfill([
    assessment({ identity: { how: 'slug-fallback', matchedIn: 'client registry', matchedName: 'kh' } }),
  ]);
  assert.equal(plan.planned.length, 0);
});

/** It rewrites a shared-schema file, so it says what it will do first. */
test('the plan is printed before anything is written', () => {
  const text = renderBackfillPlan(planBackfill([assessment()]));
  assert.match(text, /1 row\(s\)/);
  assert.match(text, /Only the place_id cell/);
  assert.match(text, /ChIJ_discovered/);
});

test('nothing to do says so rather than printing an empty plan', () => {
  assert.match(renderBackfillPlan(planBackfill([])), /nothing to do/);
});

test('applying writes the place_id and touches nothing else', () => {
  const dir = tmp();
  const file = join(dir, 'leads-machine.csv');
  const original =
    `${LEAD_HEADER}\n` +
    'K-H Machine Works,https://khmachineworks.com,machine shop,North Bergen,(201) 867-2338,manual,"a note, with comma",,,,"4322 Grand Ave",\n';
  writeFileSync(file, original, 'utf8');

  const plan = planBackfill([assessment()]);
  const applied = applyBackfill(plan, { dir });
  assert.equal(applied.written, 1);

  const after = readFileSync(file, 'utf8');
  assert.match(after, /ChIJ_discovered/);
  // Every other value survives, including the quoted note.
  assert.match(after, /a note, with comma/);
  assert.match(after, /https:\/\/khmachineworks\.com/);
  assert.match(after, /\(201\) 867-2338/);
  assert.match(after, /4322 Grand Ave/);
});

/**
 * The safety property: it can never overwrite a known-good id with a guess.
 */
test('a row that already has a place_id is never overwritten', () => {
  const dir = tmp();
  const file = join(dir, 'leads-machine.csv');
  writeFileSync(
    file,
    `${LEAD_HEADER}\nK-H Machine Works,,machine shop,North Bergen,,manual,,ChIJ_already_known,,,,\n`,
    'utf8',
  );
  const applied = applyBackfill(planBackfill([assessment()]), { dir });
  assert.equal(applied.written, 0);
  assert.match(readFileSync(file, 'utf8'), /ChIJ_already_known/);
});

test('planning alone writes nothing', () => {
  const dir = tmp();
  const file = join(dir, 'leads-machine.csv');
  const original = `${LEAD_HEADER}\nK-H Machine Works,,machine shop,North Bergen,,manual,,,,,,\n`;
  writeFileSync(file, original, 'utf8');
  planBackfill([assessment()]);
  assert.equal(readFileSync(file, 'utf8'), original);
});

// --- summary ---------------------------------------------------------------

const scored = (score, status) => ({
  result: {
    placeId: `p${score}${status}`,
    name: 'X',
    nicheLabel: 'machine shop',
    town: 'Lodi',
    phone: '(201) 555-0100',
    website: '',
  },
  status: { status },
  score,
  reasons: ['a', 'b', 'c'],
  audited: status === 'live',
  identity: { warning: '' },
});

test('the histogram bands by ten and splits by website status', () => {
  const bands = histogram([scored(95, 'none'), scored(91, 'dead'), scored(12, 'live')]);
  const top = bands.find((b) => b.floor === 90);
  assert.equal(top.total, 2);
  assert.equal(top.byStatus.none, 1);
  assert.equal(top.byStatus.dead, 1);
  assert.equal(bands.find((b) => b.floor === 10).byStatus.live, 1);
});

test('a score of 100 lands in the top band, not off the end', () => {
  const bands = histogram([scored(100, 'none')]);
  assert.equal(bands.find((b) => b.floor === 90).total, 1);
  assert.equal(bands.reduce((n, b) => n + b.total, 0), 1);
});

test('the histogram renders every band, including empty ones', () => {
  const text = renderHistogram([scored(95, 'none')]);
  assert.match(text, /90-100/);
  assert.match(text, /0-9/);
});

test('the tally reports how many live sites went unaudited, and why', () => {
  const text = renderStatusTally([scored(50, 'live'), { ...scored(40, 'live'), audited: false }]);
  assert.match(text, /Audited: 1 of 2/);
  assert.match(text, /not audited \(cap\)/);
});

test('the top list carries a one-line rationale per row', () => {
  const text = renderTop([scored(95, 'none')], 25);
  assert.match(text, /\[ 95\]/);
  assert.match(text, /a · b · c/);
});

test('a slug-fallback warning is surfaced in the top list', () => {
  const row = scored(95, 'none');
  row.identity = { warning: 'WARNING: matched by NAME SLUG' };
  assert.match(renderTop([row], 25), /WARNING: matched by NAME SLUG/);
});
