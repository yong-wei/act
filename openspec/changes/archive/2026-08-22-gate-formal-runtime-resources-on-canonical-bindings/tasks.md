## 1. Formal Inventory and Contract Foundation

- [x] 1.1 Add versioned schemas for the frozen candidate inventory, exact runtime subtypes, semantic atoms, atom dispositions, pipeline qualifications, atomic bindings, exclusion ledger, and formal-resource release envelope.
- [x] 1.2 Enumerate candidate resources only from the target Runtime Release v2 Git tree and governed external/generated input declarations.
- [x] 1.3 Classify every frozen logical-tree and governed external-input entry as one registered resource or explicit non-resource, and fail completeness on every unclassified entry.
- [x] 1.4 Produce deterministic candidate, included, excluded, and binding set ordering, counts, and canonical hashes.
- [x] 1.5 Add validators proving filenames, titles, URLs, signed URLs, local paths, runtime registry discovery, and successful-output scans cannot establish or shrink the formal denominator.

## 2. Atomic Resource Identity

- [x] 2.1 Implement stable semantic-paragraph identity, content hashes, source identity, and launch anchors for textbooks, Knowledge Cards, handouts, lectures, slides, and other text-bearing resources.
- [x] 2.2 Implement stable question/task item atoms whose binding invalidates when the stem, options, answer, or explanation changes.
- [x] 2.3 Implement media semantic-paragraph atoms bound to final media hash, duration, script identity/hash, paragraph identity/hash, and validated `startSeconds`.
- [x] 2.4 Derive media paragraph ends from the next start or final duration under a versioned rule and reject missing, duplicate, decreasing, out-of-range, or unreconstructable timing.
- [x] 2.5 Require every included atom to be `BOUND` or evidence-bearing `NON_TEACHING`, and require every included teaching resource to have at least one bound atom.

## 3. Source-specific Media Pipelines

- [x] 3.1 Add an `intro-video` import and verifier for production script/design source identity against the final media hash without replacing it with ASR.
- [x] 3.2 Add course-video and podcast/audio ASR, semantic-segmentation, and time-alignment pipeline contracts for resources without an authoritative production script.
- [x] 3.3 Build representative versioned gold and untouched holdout artifacts for ASR, segmentation, time alignment, and Canonical mapping across the target resource types and course terminology.
- [x] 3.4 Measure and freeze balanced precision/recall qualification criteria, then emit receipts bound to every model/algorithm/prompt/configuration, threshold, input, output, and evaluation identity.
- [x] 3.5 Keep every low-confidence, identity-drifted, invalid-anchor, weak-evidence, or otherwise exceptional atom out of formal bindings even when its pipeline version qualifies.

## 4. Canonical Mapping and Role Governance

- [x] 4.1 Extend Teaching Projection resource subtypes for video, audio, podcast, card, textbook, handout/slides, exercise, simulation, project, and other accepted runtime families while preserving exact subtypes.
- [x] 4.2 Preserve only `COVERS`, `EXPLAINS`, `PRACTICES`, and `ASSESSES` as teaching roles and make atomic binding identity include resource, atom, Canonical Object, role, and scope.
- [x] 4.3 Convert exact normalized labels, aliases, vector matches, and model outputs to candidates only; admit bindings solely through governed identity evidence and qualified item gates.
- [x] 4.4 Migrate current 567 legacy bindings as candidates and prove no legacy `OPTIONAL`, `NONE`, title, alias, or prior shadow state directly becomes formal.
- [x] 4.5 Implement media-wide, text-atom-selective, question-item, Authority, scope, source, role, qualification, and launcher-contract invalidation rules.

## 5. Per-resource Failure Closure

- [x] 5.1 Produce complete resource and atom dispositions so a failing resource remains in the excluded ledger with exact bounded reasons.
- [x] 5.2 Allow unrelated eligible resources to continue to a candidate release after exclusions while preserving truthful denominator counts and hashes.
- [x] 5.3 Keep excluded and unresolved resources usable only in development runtime and prevent them from formal resource manifests, graph markers, launch descriptors, RAG, recommendation, path, and evidence inputs.
- [x] 5.4 Add fixtures for missing script, source drift, invalid timecodes, unchanged/changed text atoms, changed questions, unsafe launch targets, unsupported anchors, unauthorized resources, and mixed Authority identities.

## 6. Runtime Release v2 Integration

- [x] 6.1 Extend the existing v2 manifest and immutable receipt with one formal-resource envelope binding source/tree, candidate/included/excluded/binding, Authority, course-scope, qualification, and builder identities.
- [x] 6.2 Extend publish preflight to reopen and validate every formal inventory, atom, binding, qualification, and source-proof artifact before any blob or terminal-manifest write.
- [x] 6.3 Extend materialization, readiness, active receipt, lifecycle selection, retention, and rollback validation to require the same formal envelope without adding a resource selector or pointer.
- [x] 6.4 Preserve historical v2 release compatibility while preventing an older schema from being represented as satisfying the new formal-resource gate.
- [x] 6.5 Verify failed formal candidates preserve the prior active, desired/active divergence, rollback identity, leases, and GC reachability.

## 7. Product-safe Resource Projection

- [x] 7.1 Project only exact-release, exact-Authority, exact-binding-revision, current-role-authorized formal resources into active node detail.
- [x] 7.2 Preserve safe title, exact subtype, visual family, teaching role, atomic anchor summary, and source-owned launch descriptor while excluding scripts, ledgers, confidence, review data, paths, object keys, and signed URLs.
- [x] 7.3 Upgrade existing media players, readers, exercise renderers, simulations, and other source-owned launchers to consume the governed atomic anchor where missing.
- [x] 7.4 Fail a resource's formal eligibility when its existing launcher cannot consume the governed anchor; do not embed a replacement runtime in the graph drawer.
- [x] 7.5 Keep PathNode, planning, authorization, scoring, learning-event, privacy, and evidence gates independent from formal binding and launch.

## 8. Verification and Candidate Publication

- [x] 8.1 Run schema, determinism, candidate-denominator, pipeline-qualification, item-gate, invalidation, exclusion, envelope-drift, compatibility, readiness, rollback, and product-projection tests.
- [x] 8.2 Run affected Teaching Projection, resource registry, runtime export, v2 publisher/materializer, media route, resource launcher, and data-governance test suites.
- [x] 8.3 Run `rtk npm run typecheck`, `rtk npm run test:data-governance`, the affected integration coverage, and `rtk openspec validate gate-formal-runtime-resources-on-canonical-bindings --type change --strict`.
- [x] 8.4 Build and verify a non-selectable formal Runtime Release v2 candidate with the complete target-course denominator and exclusion ledger.
- [x] 8.5 Preserve all current selectors and production state; activation, deployment, and production cutover require separate explicit authorization.
