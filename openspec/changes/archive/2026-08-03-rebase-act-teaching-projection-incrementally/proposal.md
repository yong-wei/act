## Why

Once Authority and Teaching Projection are versioned, every ActKG upgrade must avoid re-reviewing all ACT resources. The existing ReleaseSet Delta can identify changed objects; ACT needs an impact set, deterministic rebase rules, and a complete rebuilt projection with review limited to affected bindings.

## Series Dependencies

- Depends on: `activate-versioned-actkg-engineering-authority`, `introduce-versioned-act-teaching-projection`.

## What Changes

- Consume ReleaseSet Delta to calculate an ACT impact set over bindings, cards, prerequisites, and textbook locators.
- Auto-accept unrelated new engineering nodes, rebuild labels/aliases, and rebase ordinary bindings with one compatible successor.
- Mark split, merge, type-incompatible, retired-without-successor, and ambiguous cases `REVIEW_REQUIRED` only for affected consumers.
- Rebuild a complete deterministic Teaching Projection from carried-forward, rebased, and newly authored records; never patch runtime JSONL in place.
- Keep old projections usable while new Authority is staged and preserve per-record impact evidence.

## Capabilities

### New Capabilities

- `act-teaching-projection-rebase`: Delta-driven impact analysis and deterministic incremental rebase of ACT teaching artifacts.

### Modified Capabilities

- `authoritative-knowledge-release-delta`: expose the stable generic Delta categories/identity needed by ACT without making teaching review an upstream gate.

## Impact

- ReleaseSet Delta consumer, ACT projection impact report, authoring crosswalk/rebase decisions, and complete runtime rebuild.
- No new database, no ActKG semantic re-review, and no remote deployment.
