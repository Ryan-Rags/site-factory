import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseShortlistArgs, render, renderCommand, select } from '../dist/index.js';

const row = (over = {}) => ({
  placeId: 'p1',
  name: 'Alpha Machine Works',
  niche: 'machine shop',
  town: 'Lodi',
  phone: '(201) 555-0100',
  website: '',
  websiteStatus: 'none',
  score: '88',
  reasons: 'no website at all · 4.6★ from 128 reviews',
  copyPack: 'machine-shop',
  status: 'NEW',
  ...over,
});

test('--top limits and ranks by score', () => {
  const rows = [row({ placeId: 'a', score: '10' }), row({ placeId: 'b', score: '90' }), row({ placeId: 'c', score: '50' })];
  const got = select(rows, { top: 2, niche: '', status: 'NEW' });
  assert.deepEqual(got.map((r) => r.placeId), ['b', 'c']);
});

/**
 * The CSV stores the label ("welding/fabrication") but the operator types the
 * slug ("welding-fabrication"). Expecting them to remember which is which is
 * how a convenience command stops being convenient.
 */
test('--niche accepts either the slug or the label written in the CSV', () => {
  const rows = [row({ niche: 'welding/fabrication' })];
  assert.equal(select(rows, { top: 10, niche: 'welding-fabrication', status: 'NEW' }).length, 1);
  assert.equal(select(rows, { top: 10, niche: 'welding/fabrication', status: 'NEW' }).length, 1);
});

test('--niche filters out other niches', () => {
  const rows = [row({ niche: 'machine shop' }), row({ placeId: 'p2', niche: 'plumber' })];
  assert.equal(select(rows, { top: 10, niche: 'machine-shop', status: 'NEW' }).length, 1);
});

test('status defaults to NEW, so worked leads drop off the list', () => {
  const rows = [row({ status: 'NEW' }), row({ placeId: 'p2', status: 'CALLED' })];
  assert.equal(select(rows, { top: 10, niche: '', status: 'NEW' }).length, 1);
});

test('the demo id is the name slug, which is what pnpm demo takes', () => {
  const got = select([row({ name: 'K-H Machine Works' })], { top: 1, niche: '', status: 'NEW' });
  assert.equal(got[0].demoId, 'k-h-machine-works');
});

test('the command matches the real prospect CLI shape', () => {
  const rows = select([row({ name: 'Alpha Machine' }), row({ placeId: 'p2', name: 'Beta Welding' })], {
    top: 10,
    niche: '',
    status: 'NEW',
  });
  assert.equal(renderCommand(rows), 'pnpm demo -- --prospect alpha-machine --prospect beta-welding');
});

/**
 * The whole point of this command: it prints. Generating demos costs real time
 * and touches real businesses' pages, so the command is something to read and
 * paste, not something a convenience script fires off.
 */
test('the output says plainly that it did not run anything', () => {
  const rows = select([row()], { top: 1, niche: '', status: 'NEW' });
  const text = render(rows, { niche: '', status: 'NEW' });
  assert.match(text, /NOT run/);
  assert.match(text, /pnpm demo -- --prospect alpha-machine-works/);
});

test('an empty result set explains itself rather than printing a bare command', () => {
  const text = render([], { niche: 'plumber', status: 'NEW' });
  assert.match(text, /No prospects matched/);
  assert.doesNotMatch(text, /pnpm demo --/);
});

test('prospects with no copy pack are flagged before a batch is run', () => {
  const rows = select([row({ copyPack: '' })], { top: 1, niche: '', status: 'NEW' });
  assert.match(render(rows, { niche: '', status: 'NEW' }), /no copy pack/);
});

test('a missing phone is shown, not hidden — it is a call list', () => {
  const rows = select([row({ phone: '' })], { top: 1, niche: '', status: 'NEW' });
  assert.match(render(rows, { niche: '', status: 'NEW' }), /\(no phone\)/);
});

// --- args ------------------------------------------------------------------

test('the documented invocation parses', () => {
  const args = parseShortlistArgs(['--', '--top', '10', '--niche', 'machine-shop']);
  assert.equal(args.top, 10);
  assert.equal(args.niche, 'machine-shop');
  assert.equal(args.status, 'NEW');
});

test('a flag with a missing value is refused rather than guessed at', () => {
  assert.throws(() => parseShortlistArgs(['--top']), /expects a value/);
  assert.throws(() => parseShortlistArgs(['--top', '--niche']), /expects a value/);
});

test('an unknown flag is refused', () => {
  assert.throws(() => parseShortlistArgs(['--run-them']), /Unknown argument/);
});

test('--top rejects nonsense', () => {
  assert.throws(() => parseShortlistArgs(['--top', '0']), /positive integer/);
  assert.throws(() => parseShortlistArgs(['--top', 'ten']), /positive integer/);
});
