/**
 * Turns a prospect record into the read-only view the generators work from.
 *
 * Generators never touch the record directly. They ask the context, which is
 * what makes `has('walk-ins')` mean "sourced and true" everywhere rather than
 * "somebody wrote something in that field".
 */
import type { CopyContext } from '../niches/types.js';
import type { ProspectRecord, TraitId } from '../types.js';
import { isFact, value } from '../types.js';
import { list } from '../text.js';

/** Re-exported so callers that already have the context module need not also
 *  reach for `text.js` for the one join it puts on `CopyContext`. */
export { list };

export function buildContext(record: ProspectRecord): CopyContext {
  const trait = (id: TraitId): string | undefined => {
    const t = record.traits[id];
    return isFact(t) ? t.value : undefined;
  };

  const serviceTitles = record.services.map((s) => s.title);

  return {
    record,
    name: record.tradingName.value,
    town: record.town.value,
    county: value(record.county),
    serviceTitles,
    has: (id) => trait(id) !== undefined,
    trait,
    hours: value(record.hours),
    phone: record.phone.value,
    email: value(record.email),
    foundedYear: value(record.foundedYear),
    list,
    /**
     * Service titles as they read mid-sentence. `Precision Machining` is a
     * heading; `precision machining` is English. Acronyms and anything with
     * an internal capital are left alone — lowercasing `CNC Turning` to
     * `cnc turning` is the kind of detail a machinist notices immediately.
     */
    servicesSentence: () =>
      list(
        serviceTitles.map((t) => (/[A-Z]{2,}/.test(t) ? t : t.toLowerCase())),
      ),
  };
}
