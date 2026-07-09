## Design Notes

The existing `PORTRAIT_V2_DIMENSIONS` definitions are the source of ids and
labels, but they are currently a graph/objective compatibility layer. This
change makes them the primary learner portrait contract.

The primary portrait record should preserve these fields per dimension:

- stable portrait v2 dimension id
- score in 0-100 range
- confidence in 0-1 range
- freshness or evidence age metadata
- evidence count and source family counts
- last positive evidence timestamp
- last negative evidence timestamp where applicable
- rationale or limitation summary safe for learner-facing use
- calculation version

Legacy six-dimensional `CompetencyVector` may still be read to derive migration
or compatibility values, but new APIs and workers must not treat it as the
primary truth once portrait v2 is available.

The implementation may choose a JSON column, new table, or versioned snapshot
payload shape. The contract requirement is not the storage layout itself; it is
that new readers and writers have a single primary seven-dimensional portrait
shape with explicit migration metadata.

## Boundaries

This change defines and introduces the canonical model. It should not attempt
to migrate all historic data or adapt every UI surface. Those are separate
changes in this series so each execution thread has a bounded review target.

## Verification Strategy

- Unit tests for the canonical portrait v2 ids, labels, and primary payload
  shape.
- Contract tests proving legacy six-dimensional vectors are read-only
  compatibility inputs.
- OpenSpec validation and Buddy issue-body validation.
