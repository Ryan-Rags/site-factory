import {
  type Conflict,
  type Field,
  type FieldSource,
  type KnownField,
  type ProspectConfig,
  SOURCE_PRECEDENCE,
  isKnown,
} from "../types.js";

/**
 * Merging ingested data.
 *
 * Sources are ranked once, in `SOURCE_PRECEDENCE`, and a lower-ranked source
 * never overwrites a higher-ranked one. The reason the loser is *recorded*
 * rather than dropped: when the live site and the Places listing disagree
 * about a phone number, that disagreement is one of the more useful things to
 * know walking into the meeting. Silently keeping one and discarding the other
 * would destroy the finding.
 */

/** Keys of `ProspectConfig` that hold a `Field<T>`. */
export type FieldKey = {
  [K in keyof ProspectConfig]: ProspectConfig[K] extends Field<unknown> ? K : never;
}[keyof ProspectConfig];

/** What one source found. Every entry is a value it is prepared to stand behind. */
export type Contribution = {
  [K in FieldKey]?: Extract<ProspectConfig[K], KnownField<unknown>>;
};

function rank(source: FieldSource): number {
  const at = SOURCE_PRECEDENCE.indexOf(source);
  return at === -1 ? SOURCE_PRECEDENCE.length : at;
}

/** Short, comparable rendering of a value, for the conflict record. */
function describe(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} item(s)`;
  return JSON.stringify(value) ?? "";
}

/**
 * Apply one source's contribution to a prospect, in place.
 *
 * Returns the conflicts it produced (also appended to `prospect.conflicts`).
 */
export function applyContribution(
  prospect: ProspectConfig,
  contribution: Contribution,
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const [key, incoming] of Object.entries(contribution) as [
    FieldKey,
    KnownField<unknown>,
  ][]) {
    if (incoming === undefined) continue;
    const current = prospect[key] as Field<unknown>;

    // The mapped `Contribution` type guarantees `incoming` matches the field
    // it is keyed by; TypeScript cannot see that through the loop, hence the
    // one cast, isolated here rather than at every call site.
    const assign = (field: KnownField<unknown>): void => {
      (prospect as unknown as Record<string, unknown>)[key] = field;
    };

    if (!isKnown(current)) {
      assign(incoming);
      continue;
    }

    const incomingWins = rank(incoming.source) < rank(current.source);
    const kept = incomingWins ? incoming : current;
    const discarded = incomingWins ? current : incoming;

    if (describe(kept.value) !== describe(discarded.value)) {
      const conflict: Conflict = {
        field: key,
        kept: { value: describe(kept.value), source: kept.source },
        discarded: { value: describe(discarded.value), source: discarded.source },
      };
      conflicts.push(conflict);
      prospect.conflicts.push(conflict);
    }

    assign(kept);
  }

  return conflicts;
}
