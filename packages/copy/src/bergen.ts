/**
 * Bergen County, New Jersey — the 70 municipalities.
 *
 * Public record: Bergen County is one of the most heavily subdivided counties
 * in the United States, and the count of 70 is the fact most worth knowing
 * about it here. Every entry below is a municipality, not a neighbourhood or
 * a postal designation, which matters because a service-area page that lists
 * a place that is not a place reads as automated the moment a local sees it.
 *
 * VERIFY BEFORE A LIVE BUILD. This list is transcribed, and a transcription
 * is a claim like any other. `checkBergenList()` guards the count; it cannot
 * guard a spelling. Check against the county's own municipal directory before
 * any client using these sections goes live.
 *
 * What this list is *not* is an assertion that a client serves any of them.
 * Service-area copy is generated only for towns the operator put on the
 * prospect record, and the record is where the claim lives.
 */
export const BERGEN_MUNICIPALITIES = [
  'Allendale',
  'Alpine',
  'Bergenfield',
  'Bogota',
  'Carlstadt',
  'Cliffside Park',
  'Closter',
  'Cresskill',
  'Demarest',
  'Dumont',
  'East Rutherford',
  'Edgewater',
  'Elmwood Park',
  'Emerson',
  'Englewood',
  'Englewood Cliffs',
  'Fair Lawn',
  'Fairview',
  'Fort Lee',
  'Franklin Lakes',
  'Garfield',
  'Glen Rock',
  'Hackensack',
  'Harrington Park',
  'Hasbrouck Heights',
  'Haworth',
  'Hillsdale',
  'Ho-Ho-Kus',
  'Leonia',
  'Little Ferry',
  'Lodi',
  'Lyndhurst',
  'Mahwah',
  'Maywood',
  'Midland Park',
  'Montvale',
  'Moonachie',
  'New Milford',
  'North Arlington',
  'Northvale',
  'Norwood',
  'Oakland',
  'Old Tappan',
  'Oradell',
  'Palisades Park',
  'Paramus',
  'Park Ridge',
  'Ramsey',
  'Ridgefield',
  'Ridgefield Park',
  'Ridgewood',
  'River Edge',
  'River Vale',
  'Rochelle Park',
  'Rockleigh',
  'Rutherford',
  'Saddle Brook',
  'Saddle River',
  'South Hackensack',
  'Teaneck',
  'Tenafly',
  'Teterboro',
  'Upper Saddle River',
  'Waldwick',
  'Wallington',
  'Washington Township',
  'Westwood',
  'Wood-Ridge',
  'Woodcliff Lake',
  'Wyckoff',
] as const;

export type BergenTown = (typeof BERGEN_MUNICIPALITIES)[number];

const LOOKUP = new Set<string>(BERGEN_MUNICIPALITIES);

export function isBergenTown(name: string): name is BergenTown {
  return LOOKUP.has(name);
}

/**
 * Fails if the list has drifted from 70 or grown a duplicate.
 *
 * Called by the CLI rather than at import time: a corrupted list should stop
 * a generation run with a clear message, not blow up whichever unrelated
 * module happened to import this one first.
 */
export function checkBergenList(): void {
  if (LOOKUP.size !== BERGEN_MUNICIPALITIES.length) {
    throw new Error('BERGEN_MUNICIPALITIES contains a duplicate.');
  }
  if (BERGEN_MUNICIPALITIES.length !== 70) {
    throw new Error(
      `BERGEN_MUNICIPALITIES has ${BERGEN_MUNICIPALITIES.length} entries; Bergen County has 70. ` +
        `Something was added or dropped — check against the county municipal directory.`,
    );
  }
}

/**
 * Towns on the record that are not Bergen municipalities.
 *
 * Not an error — plenty of these shops serve Hudson County or the New York
 * metro, and K-H's own service area is mostly outside Bergen. The generator
 * uses this to keep the *Bergen County* section honestly Bergen, and lets
 * everything else through as wider-area copy.
 */
export function partitionTowns(towns: string[]): { bergen: string[]; other: string[] } {
  const bergen: string[] = [];
  const other: string[] = [];
  for (const t of towns) (isBergenTown(t) ? bergen : other).push(t);
  return { bergen, other };
}
