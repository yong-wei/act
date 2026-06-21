## Context

The audit proves real admin data exists: users, risks, stale-data minutes, imports, templates, and configuration providers. The problem is not absence of data; it is missing operational workflow and inconsistent filters.

## Goals / Non-Goals

**Goals:**
- Make governance risk actions object-specific and auditable.
- Make imports reversible and inspectable as batches.
- Align admin search/filter/export with visible state and API behavior.
- Productize model/provider test and statistics export outcomes.

**Non-Goals:**
- Do not redefine all data quality rules.
- Do not implement full enterprise workflow assignment beyond audited risk actions.

## Decisions

- A risk action must resolve against a risk object identity and record actor, action, outcome, and undo/rollback status.
- Import must produce a batch record even for partial failures.
- Export actions operate on the visible filtered set, not an unscoped hidden query.

## Risks / Trade-offs

- Adding audit trails can increase schema/API work. Mitigation: minimum viable audit record per risk/import/export action.
- Imports may already mutate data directly. Mitigation: wrap new UI around existing import behavior while adding batch metadata and rollback where feasible.
