## Context

The prior SVG-to-Force migration and subsequent legacy-engine migration were archived with source-oriented tests even though the runtime pinned every node, returned complete domain payloads, hid ordinary labels, omitted formula mathematics, disabled English and displayed a bottom node grid. The final series change must evaluate observable behavior and exact real-data denominators rather than implementation names.

## Goals / Non-Goals

**Goals:**

- Bind acceptance to one exact source revision and active v0.37 evidence envelope.
- Verify every one of fifteen domains and all three navigation levels.
- Measure force, labels, formulas, locales, controls, accessibility and performance behavior in real browsers.
- Reject partial, fixture-only, source-string or manually reinterpreted evidence.
- Provide one durable migration-complete gate for later releases.

**Non-Goals:**

- Implementing missing product behavior in the acceptance change.
- Activating production selectors or deploying the candidate.
- Repeating generic repository-wide UI review.
- Allowing waivers for failures inherited from either prior migration.

## Decisions

### 1. Acceptance manifest has a closed denominator

The manifest enumerates all root domains, overview shards, selected concept cases, object types, relation families, dimensions, roles, locales, viewport classes and required interactions. Every row records expected evidence, source hash and result. Missing rows fail the gate.

### 2. Behavioral probes replace source assertions

Force probes record node coordinates across ticks, collisions, settlement, pins and reflow. Network probes record response classes, bytes and counts. DOM probes record visible labels, KaTeX, language consistency, panel/list state and focus. Source inspection is supporting evidence only.

### 3. Evidence is immutable and exact-current-revision

Screenshots, traces, metrics and summaries are generated from a clean committed capture revision. The manifest binds every evidence file and relevant source to hashes. Regeneration after any relevant code or artifact change is mandatory.

### 4. Final review is independent and non-compensating

An independent reviewer checks the complete denominator, real paths, thresholds and forbidden fallbacks. A passing test elsewhere cannot compensate for a failed row. The change remains incomplete until every blocking row passes.

## Risks / Trade-offs

- [Full matrix is expensive] → Use deterministic fixtures and bounded representative interactions per domain while still covering every root/default identity.
- [Performance varies by machine] → Record hardware/browser class and use generous product budgets plus deterministic structural budgets.
- [Evidence becomes stale quickly] → Bind to exact revision and invalidate automatically when source/artifact hashes change.
- [Acceptance duplicates implementation tests] → Keep unit tests in child changes; final probes validate integrated product behavior only.

## Migration Plan

1. Define the closed matrix and failing baseline before child completion.
2. Integrate child outputs without altering their behavior in this change.
3. Capture real local role/browser evidence and performance metrics on the exact revision.
4. Run structural, privacy, accessibility, typecheck, lint, build, domain and strict OpenSpec gates.
5. Obtain independent exact-revision review; only then record migration completion.

## Open Questions

None.
