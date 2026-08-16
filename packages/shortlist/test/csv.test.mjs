import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  SCORED_COLUMNS,
  checkpointRows,
  mergeScored,
  readScored,
  toCheckpointRow,
  writeScored,
} from '../dist/index.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'shortlist-csv-'));

const row = (over = {}) => {
  const r = {};
  for (const c of SCORED_COLUMNS) r[c] = '';
  return {
    ...r,
    placeId: 'p1',
    name: 'Alpha Machine',
    niche: 'machine shop',
    town: 'Lodi',
    phone: '(201) 555-0100',
    website: '',
    websiteStatus: 'none',
    score: '88',
    reasons: 'no website at all',
    copyPack: 'machine-shop',
    status: 'NEW',
    ...over,
  };
};

test('a fresh file gets exactly the machine columns, in order', () => {
  const file = join(tmp(), 'out.csv');
  const merged = mergeScored(readScored(file), [row()]);
  writeScored(file, merged.text);
  const header = readFileSync(file, 'utf8').split('\n')[0];
  assert.equal(header, SCORED_COLUMNS.join(','));
  assert.equal(merged.added, 1);
});

/**
 * The rule that makes the file safe to work in. A pipeline that rewrites its
 * output wholesale trains the operator never to touch it, and a call list
 * nobody annotates is not a call list.
 */
test('human columns survive a re-run byte for byte', () => {
  const file = join(tmp(), 'out.csv');
  writeFileSync(
    file,
    'placeId,name,niche,town,phone,website,websiteStatus,score,reasons,copyPack,status,calledOn,notes\n' +
      'p1,Alpha Machine,machine shop,Lodi,(201) 555-0100,,none,50,old reason,machine-shop,CALLED,2026-08-01,"Spoke to Dave, call back Tuesday"\n',
    'utf8',
  );

  const merged = mergeScored(readScored(file), [row({ score: '91', reasons: 'new reason' })]);
  writeScored(file, merged.text);
  const after = readScored(file);
  const r = after.rows.get('p1');

  assert.deepEqual(merged.humanColumns, ['calledOn', 'notes']);
  assert.equal(r.calledOn, '2026-08-01');
  assert.equal(r.notes, 'Spoke to Dave, call back Tuesday');
  assert.equal(r.score, '91', 'machine columns refresh');
  assert.equal(r.reasons, 'new reason');
});

/**
 * By the time a row says CALLED, `status` is the operator's column in spirit.
 * Resetting it to NEW would quietly undo a day's phone work.
 */
test('an existing row keeps its status; the pipeline never resets it to NEW', () => {
  const file = join(tmp(), 'out.csv');
  writeFileSync(
    file,
    `${SCORED_COLUMNS.join(',')}\np1,Alpha Machine,machine shop,Lodi,,,none,50,r,machine-shop,CALLED\n`,
    'utf8',
  );
  const merged = mergeScored(readScored(file), [row({ status: 'NEW' })]);
  writeScored(file, merged.text);
  assert.equal(readScored(file).rows.get('p1').status, 'CALLED');
});

test('a new row is written NEW', () => {
  const file = join(tmp(), 'out.csv');
  const merged = mergeScored(readScored(file), [row({ status: 'NEW' })]);
  writeScored(file, merged.text);
  assert.equal(readScored(file).rows.get('p1').status, 'NEW');
});

/**
 * A narrower --niche run must not silently delete the rest of the list.
 */
test('rows this run did not see are left entirely alone', () => {
  const file = join(tmp(), 'out.csv');
  writeFileSync(
    file,
    `${SCORED_COLUMNS.join(',')}\n` +
      'p1,Alpha,machine shop,Lodi,,,none,50,r,machine-shop,NEW\n' +
      'p2,Beta,plumber,Mahwah,,,live,20,r,,NEW\n',
    'utf8',
  );
  const merged = mergeScored(readScored(file), [row({ placeId: 'p1', score: '77' })]);
  writeScored(file, merged.text);
  const after = readScored(file);

  assert.equal(after.rows.size, 2);
  assert.equal(after.rows.get('p2').name, 'Beta');
  assert.equal(merged.refreshed, 1);
  assert.equal(merged.added, 0);
  assert.equal(merged.untouched, 1);
});

test('the file is written highest score first — it IS the call list', () => {
  const file = join(tmp(), 'out.csv');
  const merged = mergeScored(readScored(file), [
    row({ placeId: 'low', score: '10' }),
    row({ placeId: 'high', score: '90' }),
    row({ placeId: 'mid', score: '50' }),
  ]);
  writeScored(file, merged.text);
  const ids = readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => l.split(',')[0]);
  assert.deepEqual(ids, ['high', 'mid', 'low']);
});

test('commas, quotes and newlines in a reason survive a round trip', () => {
  const file = join(tmp(), 'out.csv');
  const nasty = 'live site, 80% failing · says "we\'re open" · multi\nline';
  const merged = mergeScored(readScored(file), [row({ reasons: nasty })]);
  writeScored(file, merged.text);
  assert.equal(readScored(file).rows.get('p1').reasons, nasty);
});

test('a row with no placeId is kept rather than dropped', () => {
  const file = join(tmp(), 'out.csv');
  writeFileSync(
    file,
    `${SCORED_COLUMNS.join(',')}\n,Hand Added Lead,machine shop,Lodi,,,none,0,,machine-shop,NEW\n`,
    'utf8',
  );
  const merged = mergeScored(readScored(file), [row()]);
  writeScored(file, merged.text);
  assert.equal(merged.orphans, 1);
  assert.match(readFileSync(file, 'utf8'), /Hand Added Lead/);
});

/* --- the mid-sweep checkpoint -------------------------------------------- */

const swept = (over = {}) => ({
  placeId: 'p1',
  name: 'Alpha Machine',
  nicheSlug: 'machine-shop',
  nicheLabel: 'machine shop',
  town: 'Lodi',
  address: '1 Main St',
  phone: '(201) 555-0100',
  website: '',
  types: [],
  rating: '',
  reviewCount: '',
  copyPack: 'machine-shop',
  seenIn: ['machine-shop/Lodi'],
  ...over,
});

test('a checkpoint row carries discovery and leaves every assessed column empty', () => {
  const r = toCheckpointRow(swept());
  assert.equal(r.placeId, 'p1');
  assert.equal(r.name, 'Alpha Machine');
  assert.equal(r.town, 'Lodi');
  assert.equal(r.phone, '(201) 555-0100');
  // Unmeasured is empty — never a zero standing in for a score.
  assert.equal(r.websiteStatus, '');
  assert.equal(r.score, '');
  assert.equal(r.reasons, '');
});

test('a checkpoint never overwrites a score an earlier run measured', () => {
  const file = join(tmp(), 'out.csv');
  writeScored(file, mergeScored(readScored(file), [row({ placeId: 'p1', score: '88' })]).text);

  // The same business turns up again mid-sweep, before this run has assessed it.
  const rows = checkpointRows([swept({ placeId: 'p1' })], readScored(file));
  assert.equal(rows.length, 0, 'an already-scored row is left alone');

  writeScored(file, mergeScored(readScored(file), rows).text);
  assert.equal(readScored(file).rows.get('p1').score, '88', 'the measurement survives');
});

test('a checkpoint does write a business the file has never seen', () => {
  const file = join(tmp(), 'out.csv');
  writeScored(file, mergeScored(readScored(file), [row({ placeId: 'p1' })]).text);

  const rows = checkpointRows([swept({ placeId: 'p2', name: 'Beta Welding' })], readScored(file));
  assert.equal(rows.length, 1);

  writeScored(file, mergeScored(readScored(file), rows).text);
  const after = readScored(file);
  assert.equal(after.rows.get('p2').name, 'Beta Welding');
  assert.equal(after.rows.get('p2').score, '', 'written as unscored, not as a zero');
  assert.equal(after.rows.get('p1').score, '88', 'the other row is untouched');
});

test('a checkpoint refreshes a row an earlier crash left unscored', () => {
  const file = join(tmp(), 'out.csv');
  writeScored(file, mergeScored(readScored(file), [toCheckpointRow(swept({ placeId: 'p3' }))]).text);

  const rows = checkpointRows([swept({ placeId: 'p3', phone: '(201) 555-0199' })], readScored(file));
  assert.equal(rows.length, 1, 'an unscored row is safe to rewrite');
});

test("a checkpoint preserves Ryan's own columns, like any other write", () => {
  const file = join(tmp(), 'out.csv');
  writeFileSync(
    file,
    `${SCORED_COLUMNS.join(',')},NOTES\np9,Gamma Tool,machine shop,Lodi,,,,,,machine-shop,CALLED,left a voicemail\n`,
    'utf8',
  );
  const rows = checkpointRows([swept({ placeId: 'p9', name: 'Gamma Tool' })], readScored(file));
  writeScored(file, mergeScored(readScored(file), rows).text);

  const after = readScored(file).rows.get('p9');
  assert.equal(after.NOTES, 'left a voicemail');
  assert.equal(after.status, 'CALLED', 'a checkpoint never resets tracking state');
});
