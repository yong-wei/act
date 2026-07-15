## 0. Preflight Baseline

- [x] 0.1 Record the proposal-time baseline `npm run test:unit -- src/lib/__tests__/resource-node-knowledge-workspace-ui.test.ts` as 11/12 with the known source-string URL assertion failure; before any feature edit, replace that assertion with a directly callable URL/deep-link behavior contract, rerun the exact command to establish 12/12, and retain it as a final regression gate.

## 1. Relation Projection And Geometry

- [x] 1.1 Implement the normative supported-type, English/Chinese alias, and zero-instance `follows` grammar table; lossless family projection; directed/unordered keys; reverse-child blocking; post-requisite cycle handling; cross-family coexistence; directional inspector sentences; unavailable-evidence state; exclusion of synthetic `chapter-link:*` membership from relation projection; and an end-to-end blocking checker for malformed JSONL, missing/empty/unknown type, duplicate relation id, loading, labeling, projection, and inspection.
- [x] 1.2 Implement shared node-boundary intersection, straight/reciprocal curve, endpoint-arrow, path-point, and tangent helpers used by static and animated rendering.

## 2. Navigation And Progressive State

- [x] 2.1 Replace recursive expansion state with explicit compact root and single-domain navigation while reusing versioned root and domain expansion shards, including loading, failure, retry, filtered-empty, and cache-reuse states.
- [x] 2.2 Route canvas, semantic node, directory, search, deep-link, inspector, and cross-domain activation through one navigation-aware resolver with pointer and keyboard parity; normalize trusted launch/deep-link lesson context to `/knowledge?lessonId=` and clear invalid, deleted, switched, or removed lesson state.
- [x] 2.3 Decouple selected node, inspector visibility, domain navigation, loading, and blank-canvas dismissal so inspection never drives relayout or unintended domain exit.

## 3. Layout And Labels

- [x] 3.1 Implement deterministic collision-safe compact packing for large top-level domain nodes and a visible accessible return-to-domains action.
- [x] 3.2 Add a server-only exact runtime-lesson lookup and sanitized graph `lessonContext`; implement a reviewed authoring-order resolver where sequence order is authoritative when present, manifest matches exactly, and manifest-only requires exact `graph_order_policy: "manifest-reviewed-no-sequence"`; make `1-1`/`4-2`/`5-2` exactly equal before review/export and allow no waiver. Export runtime order only from this resolver. Implement the exact normalized-link schema, null-aware stable sort, RFC 8785/UTF-8/SHA-256 `overlayRevision`, and shared canonical-byte/digest vectors across Python/TypeScript. Preserve lesson order ahead of path layout for covered nodes, diagnose conflicts, forbid other fallbacks, clear invalid context, require canonical edge triples, and implement bounded layout.
- [x] 3.3 Implement shared larger centered wrapped-label layout with bounded line count, accessible full names, and collision bounds for 2D and 3D nodes.

## 4. Relation Controls And Rendering

- [x] 4.1 Remove learner-facing raw-type/density/strength/connected-node/dense-mode controls and replace them with the compact bottom-left `全部`/`子级`/`后置`/`关联` control and mobile equivalent, including shared state, child-off default, zero-before-selection and 24-edge one-hop association density, select-all/default restoration, mixed state, keyboard semantics, and domain-scoped shard behavior.
- [x] 4.2 Update 2D and 3D renderers to use the same visible domain subset, three-family styles, boundary-clipped edges, reciprocal curves, target arrowheads, label layering, and selected-corridor emphasis.

## 5. Learning-Path Focus And Motion

- [ ] 5.1 Implement selected-node corridors only from authored canonical post-requisite edges with four-level/64-node/96-edge bounds, strength/stable-id capping, shared-segment deduplication, SCC motion suppression, active-domain clipping, and explicit adjacent-domain navigation; ignore persisted LearningPath and ResourceNode path context entirely.
- [ ] 5.2 Implement selected-only moving directional arrows that follow shared edge geometry and tangents from source boundary to target boundary, disappear and restart, render beneath nodes, and stop under reduced motion or inactive focus.

## 6. Inspector And Detail Semantics

- [ ] 6.1 Update the inspector to group child/domain membership, prerequisite/post-requisite navigation and the currently derived canonical corridor, cycle/conflict states, and every raw association type with source/target Chinese sentences, available provenance, explicit unavailable-evidence state, and adjacent-domain corridor navigation without stale async replacement; remove `path-eligibility` display and any persisted planned-segment trigger.
- [ ] 6.2 Preserve source-owned ResourceNode and adaptive-node launch as opaque actions, Knowledge Card, evidence, assistant context, active section and scroll context, drag/pan dismissal, collapsed-sheet graph access, mobile focus containment, and return-focus behavior through domain and node transitions without importing persisted path data.

## 7. Verification

- [ ] 7.1 Add unit and component coverage for relation normalization/blocking, chapter exclusion, cycles/provenance, lesson URL/clear/shared-node behavior, sequence/manifest agreement/mismatch/exact manifest-only policy, mandatory `1-1`/`4-2`/`5-2` reconciliation, cross-language overlay canonical bytes/digests with Chinese/null/negative/zero/`1.0`/equal-prefix reordering, canonical edge triples, persisted-path non-consumption, bounded canonical corridor/cross-domain/domain-switch/motion/reduced-motion/stale behavior, and layout/label/geometry/accessibility/renderer parity.
- [ ] 7.2 Replace the legacy `getRelationCategory` projection path with the normative projector; add a deterministic relation-coverage command with machine-readable failures for direction, malformed input, duplicate ids, chapter-link exclusion, order sources, density, cycles, provenance, overlay triple eligibility, and unknown types; add archive-contract tests proving `path-eligibility`, planned-segment triggers, persisted-path consumption, removed raw controls, and global remaining-shard learner flows do not survive archive while source-owned resource launch remains; rerun the exact 0.1 baseline command.
- [ ] 7.3 Add browser acceptance for root-to-domain-to-node navigation, shard loading/failure/retry/filtered-empty/cache reuse, return navigation, compact legend all/mixed/default and 24-edge association states, persistent inspector, child/cycle/directional provenance, canonical cross-domain corridor navigation, persisted-path non-consumption, read-only completion semantics, async scroll preservation, drag/pan and blank-canvas dismissal, collapsed mobile sheet access, and pointer/keyboard parity.
- [ ] 7.4 Capture and record the checked-in largest-domain fixture hash, Chromium/reference hardware, 1440×900 DPR1 viewport, warm-up and formulas; verify 2D/3D parity, zero node-body overlap, label-pair ratio, three-marker cap, frame interval, and long-task bounds; manually include lesson 1-1, lesson 5-3, the densest association domain, reciprocal/SCC, no-order-source, and canonical cross-domain corridor fixtures.
- [ ] 7.5 Update `course-content/scripts/review_lesson_content.py`, `course-content/scripts/export_runtime.py`, runtime overlay types/loaders, and tests to share the exact order resolver, manifest-only policy, RFC 8785 canonical serializer, link shape/sort, cross-language canonical-byte/revision vectors, duplicate-id and missing/empty/unknown-type blocking, and overlay-triple diagnostics; make `1-1`/`4-2`/`5-2` sequence and manifest orders exactly equal before review/export can pass; then run focused graph/content tests, typecheck, applicable lint, strict OpenSpec/Buddy validation, and canonical data immutability diffs for independent and course review.
