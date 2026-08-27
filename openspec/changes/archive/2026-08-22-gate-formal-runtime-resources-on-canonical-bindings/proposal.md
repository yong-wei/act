## Why

The current active graph cannot display system resources because its shard has no matching Teaching Projection identity, and the existing projection covers only lesson/step/textbook records while formal videos, audio/podcasts, cards, handouts, exercises, simulations, and other runtime resources remain outside a common atomic binding gate. A formal Runtime Release must prove what was considered, what was included or excluded, and where each teaching resource binds before it can become selectable.

## What Changes

- Build the formal release denominator from every candidate resource intended for the target Runtime Release v2, including Git-managed and declared external/generated inputs. Nodes may have no resources; every included teaching resource must have at least one valid Canonical binding.
- Extend resource types without changing teaching-role meaning: `COVERS`, `EXPLAINS`, `PRACTICES`, and `ASSESSES` remain orthogonal to video, audio, podcast, card, textbook, handout/slides, exercise, simulation, project, and other registered runtime subtypes.
- Segment video and audio transcripts into stable semantic paragraphs with validated `startSeconds`; derive each end from the next paragraph or final media duration. Use production script/design sources for `intro-video`, and qualified ASR/segmentation/time-alignment for course video and podcast/audio.
- Segment textbooks, cards, handouts, lecture text, and other textual resources by stable semantic paragraph; treat an exercise/question item as its atomic unit. Bind each atom to one or more in-scope Canonical Objects or record an audited non-teaching disposition for truly non-instructional material.
- **BREAKING** Exact normalized labels or aliases and model output may create candidates only; they can no longer directly produce a formal `BOUND` record. Every formal binding must pass stable identity, content/version, source, role, scope, anchor, evidence, and pipeline qualification gates.
- Qualify ASR, semantic segmentation, time alignment, and Canonical mapping pipeline versions against representative versioned gold/holdout artifacts using balanced precision/recall criteria. Individual low-confidence or invalid atoms remain excluded even when the pipeline qualifies.
- Fail closed per resource: an invalid or unresolved resource remains available in development runtime but is excluded from the formal manifest; unrelated valid resources may continue. Preserve every exclusion and reason in a candidate disposition ledger so the denominator cannot be reduced silently.
- Extend the existing content-addressed Runtime Release v2 manifest/receipt/pointer with exact candidate, included, excluded, binding-set, Authority, source, and pipeline-qualification hashes. Do not introduce a parallel release selector or resource authority.
- Project only current, authorized formal bindings into graph node markers and the node drawer. Preserve exact runtime subtypes while aggregating simultaneous internal node markers by visual family; launch through existing source-owned players/readers/exercise renderers at the bound atomic anchor.

## Capabilities

### New Capabilities

- `formal-runtime-atomic-resource-binding`: Defines formal resource inventory, atomic anchors, qualified automatic binding, audited non-teaching dispositions, per-resource exclusion, release receipt closure, and product-safe binding projection.

### Modified Capabilities

- `canonical-knowledge-resource-binding`: Narrows deterministic auto-binding, replaces optional/`NONE` publication shortcuts for formal teaching resources, and makes atomic resource dispositions and current-release identity mandatory.
- `act-teaching-projection`: Extends the resource subtype vocabulary and requires formal resource bindings to preserve the four existing teaching roles, atomic identities, scopes, and release envelope.
- `media-source-manifest-ingestion`: Requires media/script identity, semantic-paragraph anchors, validated start times, deterministic end derivation, and qualified source-specific transcript pipelines.
- `resource-segment-scene-binding`: Makes stable semantic paragraphs and question items the formal binding atoms while retaining retrieval, path eligibility, and learning-evidence boundaries.
- `content-addressed-runtime-release-storage`: Extends the existing v2 manifest, receipt, readiness, and lifecycle selection gate with immutable candidate/included/excluded/binding/Authority qualification identities.

## Impact

- Affects runtime resource inventory/export, Teaching Projection resource contracts/builders, Canonical binding candidates and decisions, media/text/question segmentation, release v2 manifest and receipt generation, active resource-binding projection, existing launchers, graph marker aggregation, and governance tests/reports.
- Does not require one resource per Canonical Object, make a segment a PathNode, infer mastery from a binding or launch, expose review artifacts in the application, add a reviewer role/entitlement, or duplicate resource renderers inside the graph drawer.
- External URLs, filenames, titles, and signed URLs are launch locations only; immutable media/content hashes and source declarations establish formal identity.
- The accepted release-gate decision is recorded in `docs/grill/20260822-am/adr/20260822-gate-formal-runtime-resources-on-atomic-canonical-bindings.md`.
