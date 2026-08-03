## Context

The Authority Snapshot change makes a new release independently available. This rebase change follows the versioned Teaching Projection and consumes only the accepted Delta identities. Human work is incremental; runtime materialization remains full and deterministic.

## Series Dependencies

- Depends on: `activate-versioned-actkg-engineering-authority`, `introduce-versioned-act-teaching-projection`.

## Goals / Non-Goals

**Goals:**

- Compute a precise impact set for existing ACT bindings and derived teaching artifacts.
- Automate safe one-to-one successor migration and stable label/alias rebuilds.
- Fail closed on split/merge/ambiguous semantics while preserving unaffected records byte-for-byte where possible.

**Non-Goals:**

- Do not rerun course review for unbound new Authority objects.
- Do not use fuzzy/model inference as an automatic rebase decision.
- Do not mutate production JSONL in place or change consumer activation in this change.

## Decisions

### 1. Impact categories

The consumer accepts node changes `ADDED`, `METADATA_CHANGED`, `TYPE_CHANGED`, `DEPRECATED`, `REPLACED_BY`, `SPLIT`, `MERGED`, `REMOVED_WITHOUT_SUCCESSOR`; relation changes `RELATION_ADDED`, `RELATION_CHANGED`, `RELATION_RETIRED`; and source changes `SOURCE_ANCHOR_CHANGED`, `SOURCE_DOCUMENT_CHANGED`. Each category binds exact Delta/Authority IDs.

### 2. Impact rules

Unbound added nodes produce zero ACT review items. New engineering relations are accepted for Engineering Authority. Label/alias-only changes rebuild indexes. Bound type/semantic changes affect direct resources. Single type-compatible successor auto-rebases ordinary bindings and records an audit row. Cards and prerequisites are separately marked for local inspection. Split, merge, no-successor, or ambiguous cases become `REVIEW_REQUIRED` in affected packages only. Anchor changes affect corresponding textbook resources only.

### 3. Complete rebuild

The builder combines unchanged records, deterministic rebase records, and new authoring decisions into a new full Projection Snapshot. It sorts/serializes all artifacts canonically and emits impact report, carried-forward digest map, and unresolved records. It never edits the previous runtime release.

### 4. Rebase decisions and fallback

An auto-rebase decision stores source Canonical, successor, compatibility rule/version, Delta identity, and audit reason. Manual decisions are authoring records reused on repeat builds. Until activation, consumers may continue using the previous Authority/Projection combination.

## Risks / Trade-offs

- Conservative review of split/merge cases may leave some resources temporarily unavailable; this prevents silent semantic drift.
- Full rebuild costs more than patching files, but makes projection hashes reproducible and rollback-safe.

## Migration Plan

Run the impact calculator against a representative Delta, compare expected affected resources, then stage a complete rebuilt snapshot. Existing consumers remain pinned until later activation readiness succeeds.

## Open Questions

None. Impact categories and rebase rules are fixed for the first implementation.
