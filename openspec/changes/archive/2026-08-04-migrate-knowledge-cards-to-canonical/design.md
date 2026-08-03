## Context

The card migration follows active course resource mapping and core prerequisite publication. A card explains a Canonical node as an ACT resource; it is not an engineering object. Existing card review, citation, and ResourceNode gates remain in force.

## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`, `publish-core-teaching-prerequisites`.

## Goals / Non-Goals

**Goals:**

- Establish one deterministic active card index by Canonical ID.
- Make card-required behavior explicit and local to core/step consumers.
- Preserve old IDs and fallback diagnostics for historical content and rollback.

**Non-Goals:**

- Do not author new card content, redesign card UI, or migrate every historical fact.
- Do not require cards for every Authority node or every path resource.
- Do not remove fallback code; retirement is a later independent change.

## Decisions

### 1. Card resource identity

Each card stores `cardId`, exactly one `canonicalId`, `status`, title/content version, projection scope, source hash, and optional `legacyAliases`. The runtime index is `canonicalId -> active card` and rejects more than one ACTIVE card per Canonical ID.

### 2. Step resolution

Interactive steps and course resources reference Canonical IDs, not card IDs. At runtime, `step -> canonicalId -> optional active card`; a missing optional card returns the Canonical summary and other linked resources. `cardPolicy: REQUIRED` is honored only for explicitly selected core nodes/steps.

### 3. Migration classification

One old node to one Canonical auto-migrates. Multiple old cards to one Canonical require choosing/merging one primary; one old node to many Canonicals requires a content split; no mapping retains a legacy fallback; course-specific cases move to lesson/step resources. Every non-automatic class emits a reason and author decision requirement.

### 4. Retirement telemetry

Every legacy fallback lookup records card identity, Canonical/crosswalk outcome, consumer, and projection. Fallback count must reach zero for the migrated scope before a later retirement change can remove the reader.

## Risks / Trade-offs

- Duplicate cards may temporarily be unavailable until one primary is selected; this is safer than nondeterministic selection.
- Optional card absence may reduce summary richness, but it must not hide a valid node or block unrelated path resources.

## Migration Plan

Inventory cards, create crosswalk, auto-migrate one-to-one records, resolve duplicate/split/unmapped decisions, generate card index, and update active steps. Keep legacy fallback and monitor hit counts; do not delete old readers here.

## Open Questions

None. Card policy and fallback retirement conditions are fixed.
