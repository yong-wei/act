## 1. Metric Model

- [x] 1.1 Define the session governance readiness metric set and reason codes.
- [x] 1.2 Separate snapshot coverage from post-class update-window coverage.
- [x] 1.3 Define feature-cache freshness independently from snapshot coverage.

## 2. Report and API Migration

- [x] 2.1 Update class session reports and data-quality scripts to compute the
  new metrics.
- [x] 2.2 Update teacher/admin payload field names or compatibility mappings so
  they do not conflate missing snapshots, missing post-class regeneration, and
  stale feature cache.
- [x] 2.3 Keep existing consumers working through documented compatibility
  fields where needed.

## 3. Validation

- [x] 3.1 Add tests for durable submission, scoreable evidence, scoring,
  snapshot, post-class window, and feature-cache freshness metrics.
- [x] 3.2 Add a 5-3-like regression case where latest snapshots cover latest
  facts but post-class regeneration is partial.
- [x] 3.3 Validate with `rtk openspec validate refine-session-governance-readiness-semantics --strict`.
