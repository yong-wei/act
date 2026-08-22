## Context

The current Teaching Projection contains 567 resource bindings over 525 resources and 48 Canonical Objects, concentrated in lesson steps, lessons, and textbook sections. It has no formal video/audio/podcast/exercise resource contract and does not match the active Authority shard identity. Most legacy rows also lack safe current detail titles. These records are migration candidates, not evidence that the formal runtime resource inventory is bound.

Runtime Release v2 already provides the content-addressed manifest, source-proof, receipt, lifecycle, active pointer, and rollback authority. Its source identities are Git objects or explicitly declared external/generated inputs; a URL, signed URL, filename, or title cannot establish resource identity.

This design follows `docs/grill/20260822-am/adr/20260822-gate-formal-runtime-resources-on-atomic-canonical-bindings.md`.

## Goals / Non-Goals

**Goals:**

- Freeze the complete candidate denominator for every resource intended for one formal Runtime Release v2.
- Give every included teaching resource atomic, evidence-bearing Canonical bindings while allowing Canonical nodes with no resources.
- Support text semantic paragraphs, media semantic paragraphs with validated start times, and stable exercise items.
- Qualify automatic ASR, segmentation, time alignment, and Canonical mapping pipelines on frozen representative evidence.
- Exclude a failing resource without blocking unrelated valid resources, while preserving every exclusion in the denominator ledger.
- Extend the existing v2 release receipt and pointer gate rather than creating a second release authority.
- Project only current authorized formal resources to graph markers and source-owned launches.

**Non-Goals:**

- Requiring each Canonical Object to have a resource.
- Turning a ResourceSegment, binding, launch, playback, or read into a PathNode, mastery claim, or learning event.
- Adding an online review service, system role, entitlement, or runtime audit UI.
- Embedding new players, readers, exercise renderers, or simulations inside the graph drawer.
- Governing Canonical Object-to-Object teaching relations.

## Decisions

### 1. The formal denominator is a frozen candidate inventory

Before body publication, the release builder enumerates every Git-managed and declared external/generated resource intended for the target Runtime Release. Each candidate has a stable resource identity, exact runtime subtype, course scope, source identity, content identity, and final `INCLUDED` or `EXCLUDED` disposition. Candidate, included, excluded, and atomic binding sets receive independent canonical hashes.

The formal denominator is not reconstructed from a working directory, current UI registry, successful files, or bindings already found. Exclusion never removes an item from candidate counts. Non-teaching assets may be excluded only through an explicit repository disposition with evidence and invalidation rules.

### 2. Formal resources close at atomic units

The binding atom is:

- one semantic paragraph for video, audio, podcast, textbook, Knowledge Card, handout, lecture, slide text, and other text-bearing resources;
- one stable question/task item for exercises.

Every atom carries stable identity, parent resource, exact subtype, source/content hash, anchor, course scope, disposition, and evidence. A formal teaching resource must have at least one `BOUND` atom. Non-instructional atoms such as intros, transitions, or copyright notices may be `NON_TEACHING` only through a governed repository disposition. Each binding identity includes `resourceId + atomId + canonicalId + role + scopeId`.

The four roles remain `COVERS`, `EXPLAINS`, `PRACTICES`, and `ASSESSES`; media type and teaching role are orthogonal.

### 3. Media paragraphs store starts and derive ends

Every media semantic paragraph stores a validated `startSeconds`, final media hash, duration, script identity/hash, paragraph identity/hash, and time-rule version. The end is derived from the next paragraph start or final media duration. Duplicate, negative, non-monotonic, out-of-range, or unreconstructable timing fails the resource.

`intro-video` imports the production project's script and design source and verifies both against the final media identity. Course video and podcast/audio use qualified ASR, semantic segmentation, and time alignment. ASR never overwrites an available production script authority.

### 4. Automatic admission is version-qualified and item-fail-closed

ASR, semantic segmentation, time alignment, and Canonical mapping versions each bind representative gold/holdout artifacts, measured balanced precision/recall policy, frozen thresholds, model/algorithm/prompt/configuration, input hashes, and output hash. Any relevant change requires a new qualification receipt.

Qualification removes a universal per-resource human-signoff requirement, but no item bypasses identity, confidence, evidence, anchor, role, scope, and endpoint validation. Normalized label/alias, vector similarity, or model output generates a candidate only; it cannot directly create a formal `BOUND` record.

### 5. Invalidation follows resource semantics

- A media content hash change invalidates the full script, semantic segmentation, timing, and binding set.
- A text rebuild retains only atoms whose stable ID and content hash both remain unchanged; added, removed, or changed paragraphs are reprocessed.
- A question change to stem, options, answer, or explanation invalidates the item binding.
- Authority, course scope, role, source identity, pipeline qualification, or launch-contract drift invalidates dependent formal eligibility.

### 6. Failure closes per resource and preserves the ledger

A resource with invalid source identity, transcript, atomization, timing, mapping, binding completeness, safe launch target, or anchor-consumption capability becomes `EXCLUDED` from the formal manifest and stays available only in development runtime. Other valid resources may continue. The candidate ledger records the failed resource and exact bounded reasons, so formal success cannot be manufactured by omission.

Legacy `OPTIONAL` describes course delivery optionality, not binding optionality. Legacy `NONE` cannot admit an unbound teaching resource; it must migrate to atomic `NON_TEACHING` dispositions or formal exclusion.

### 7. Runtime Release v2 remains the only release authority

A formal-resource envelope is sealed into the existing v2 candidate manifest and receipt. It binds source revision/tree identity, candidate/included/excluded/binding hashes, Authority identity, course scope, qualification receipts, and validator/builder versions. Candidate preflight verifies every referenced artifact before any blob or selector write. The active receipt and lifecycle pointer must bind the same envelope.

Older v2 releases remain valid under their historical schema; the new gate applies when a candidate declares the formal-resource contract. No second current pointer, resource selector, or parallel release lifecycle is introduced.

### 8. Product projection is minimal, current, and access-safe

Active node detail receives only formal resources whose Release, Authority, binding revision, and current-role access match. It includes safe title, exact subtype, teaching role, visual family, atomic anchor summary, and source-owned launch descriptor. It excludes scripts, candidate ledgers, confidence, review state, internal paths, object keys, and signed URLs.

Graph markers aggregate exact resources into visual families. The drawer delegates to existing renderers at the atomic anchor; if a renderer cannot consume that anchor safely, the resource is ineligible for formal inclusion.

## Risks / Trade-offs

- [The true resource denominator may be larger than current projections] → Derive it from the frozen release candidate inventory and keep every exclusion visible in the ledger.
- [External media may lack stable source identity] → Require declared external-input identity plus final content hash; URLs and filenames are never identity evidence.
- [Automatic media processing may drift] → Bind every output to qualified pipeline versions and invalidate on model, prompt, configuration, source, or content changes.
- [Per-resource exclusion could hide systemic failure] → Record candidate/included/excluded counts and hashes in the release receipt and set acceptance thresholds through governance evidence.
- [Atomic launches may not be supported by existing renderers] → Upgrade source-owned launcher contracts; do not publish a resource until its anchor is consumable.
- [New receipt fields could split release authority] → Extend the existing v2 schema and lifecycle transaction only; do not introduce another selector.

## Migration Plan

1. Add formal inventory, atom, disposition, pipeline qualification, binding, and release-envelope schemas plus complete drift/failure fixtures.
2. Extend text, question, intro-video, course-video, and podcast/audio inventory and atomization pipelines with exact source and content identities.
3. Qualify the automatic pipelines on versioned representative gold/holdout artifacts.
4. Reprocess legacy bindings as candidates; do not promote label/alias matches, `OPTIONAL`, or `NONE` directly.
5. Build the complete candidate ledger, exclude failing resources, and produce atomic formal bindings for included resources.
6. Extend v2 preflight, manifest/receipt validation, materialization, readiness, rollback, and lifecycle selection with the formal envelope.
7. Project eligible formal resource summaries to the migrated graph and verify source-owned launchers consume their anchors.
8. Publish a non-selectable candidate first. Selection and production activation require separate authorization.

Rollback preserves the prior active v2 release and its receipt. A failed formal candidate never replaces active or rollback lifecycle identities.

## Open Questions

None. Numeric qualification thresholds are determined and frozen only after representative gold/holdout measurement.
