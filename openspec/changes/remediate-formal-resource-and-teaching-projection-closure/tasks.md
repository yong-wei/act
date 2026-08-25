## 1. Capture and Completion Authority

- [x] 1.1 Add a failing regression proving that builders, fixtures, caller-provided hashes, and writable completion fields cannot satisfy remediation completion without reopenable corpus artifacts.
- [x] 1.2 Reuse one immutable shared coordination-allocation schema and validator across remediation and downstream cutover, requiring an opaque unique coordination run ID, exact Authority capture, compatibility result, sealed target-course active-domain scope, formal successor resource denominator, policy versions, implementation identities, terminology/locale identities, source registries, processor registry, validators, and course-owner decision identity.
- [x] 1.3 Repair or isolate historical incomplete ActKG release manifests in latest-compatible capture discovery, then capture the execution-time latest complete formal Authority without modifying ActKG source data.
- [ ] 1.4 Build the successor logical-resource denominator from the production-active OSS Runtime Release plus explicitly declared new or changed release inputs, preserving stable logical IDs and source hashes.
- [ ] 1.5 Add conservation and continuity validation requiring every active-baseline teaching resource to remain `INCLUDED` unless explicitly retired, every eligible new-delta resource to finish as `INCLUDED` or `EXCLUDED`, and every included atom to finish as `BOUND` or evidenced `NON_TEACHING`.
- [x] 1.6 Add a regression proving a technical failure blocks completion for an active-baseline resource but yields development-only exclusion for an equivalent new-delta resource.
- [x] 1.7 Seal and reopen one clean shared coordination allocation through both remediation and downstream validators, prove all mandatory fields and hashes are identical, and record diagnostic inventory differences without treating prior counts as authority.

## 2. Source Provenance and Processing Records

- [x] 2.1 Define immutable external-input/source-provenance manifests that replace ignored paths, dirty workspace state, and local filenames with captured content identities and private execution receipts.
- [x] 2.2 Implement artifact discovery and independent reopening so every reported atom, binding, ledger, projection, and hash is recomputed from a declared file rather than accepted as a string.
- [x] 2.3 Implement resource-level processing records with source, processor, validator, atom, mapping, anchor, launch, disposition, limitation, and output identities.
- [x] 2.4 Add privacy validation that prevents absolute local paths, raw answer payloads, private repository internals, credentials, signed URLs, and unrestricted transcript bodies from entering public runtime projections.
- [x] 2.5 Add deterministic summary generation and negative tests for missing rows, duplicate rows, orphan outputs, cross-capture inputs, hash drift, and unknown disposition states.

## 3. Intro-video Production-source Import

- [x] 3.1 Inventory the execution-time Videos source projects and map each ACT `intro-video` logical resource to an explicit unit and composition identity without relying on render filenames.
- [ ] 3.2 Implement the Videos importer for repository/external-input identity, composition, design, timeline, captions, script outline, script cues, referenced assets, final render, and importer receipts.
- [ ] 3.3 Generate immutable provenance manifests for every target `intro-video` and verify final render hash/duration against the ACT authoring and runtime targets.
- [ ] 3.4 Import only the governed production source material required for ACT runtime processing and preserve content-addressed lineage to the Videos source.
- [x] 3.5 Derive semantic paragraphs and time anchors from the verified production script/cues/timeline, retaining production source as transcript authority.
- [ ] 3.6 Add end-to-end tests rejecting missing source files, ambiguous unit mapping, render-only filename matches, target hash drift, and ASR overwrite of authoritative production scripts.
- [x] 3.7 Run the importer over the complete captured `intro-video` denominator and commit the actual manifests, atom outputs, validation report, and explicit failures; current discovery expects 31 resources but execution-time accounting is authoritative.

## 4. Fun-ASR-Nano and Handout-derived Hotwords

- [x] 4.1 Detect the downloaded LM Studio Fun-ASR-Nano instance and freeze model identifier/revision, available weight hashes, quantization, LM Studio/runtime/API versions, backend, timestamp mode, hotword contract, and decoding configuration without assuming download completion.
- [x] 4.2 Implement a bounded local Fun-ASR-Nano adapter that records normalized requests/responses and fails closed on model, runtime, API, timestamp, or hotword-contract drift.
- [x] 4.3 Bind every ASR-targeted video, audio, and podcast item to the exact frozen handout or lecture resource and semantic paragraphs from which the media was produced.
- [x] 4.4 Implement the deterministic hotword extractor for handout/lecture Markdown, including normalization, deduplication, bounded weights, governed terminology matching, safe pronunciation aliases, and explicit exclusions.
- [x] 4.5 Persist one immutable per-resource hotword manifest with source paragraph IDs/hash, extractor/configuration, terminology identity, entries/weights, exclusions, request representation, and manifest hash.
- [x] 4.6 Build and manually verify representative real Chinese control-theory transcript/time-anchor truth, then seal the corpus selection policy, calibration/gold membership, blind-holdout membership and reference hashes before pipeline tuning.
- [x] 4.7 Implement paired calibration comparing Fun-ASR-Nano with and without hotwords for character/word errors, substitutions, deletions, terminology recall, false insertions, timestamp monotonicity, duration coverage, and semantic-boundary validity.
- [x] 4.8 Select the exact model/runtime/hotword/segmentation/alignment configuration and thresholds from calibration only, then seal a pre-registration receipt before opening holdout results.
- [x] 4.9 Run one formal evaluation against the untouched holdout and seal the qualification receipt; a failed or changed configuration requires a new identity and newly sealed untouched holdout rather than post-hoc threshold changes.
- [ ] 4.10 If the downloaded processor fails the pre-registered holdout gate, stop formal processing and request a model decision rather than substituting an unqualified fallback.
- [x] 4.11 Implement semantic-paragraph segmentation, timestamp alignment, deterministic end derivation, confidence/limitation capture, and complete downstream invalidation from ASR or hotword drift.
- [x] 4.12 Run the qualified pipeline over every captured course video, audio, and podcast without authoritative production scripts and persist actual transcripts, hotword manifests, semantic time atoms, receipts, and explicit exclusions.
- [x] 4.13 Manually sample the actual media outputs across course units and resource subtypes, record course-owner acceptance or correction, and re-run affected items until every target has a final disposition.

## 5. Text, Card, and Infograph Atoms

- [ ] 5.1 Implement the textbook processor by reopening the structured v2 source manifests and stable fragment anchors, verifying source/locator identity, and emitting real semantic-paragraph atoms.
- [ ] 5.2 Run the textbook processor over every textbook/reference resource in the captured denominator and persist actual atoms, locator evidence, validation reports, and exclusions.
- [x] 5.3 Implement the handout/lecture processor using authoring Markdown semantic paragraphs as truth and binding exported PDF/page anchors only as launch derivatives.
- [x] 5.4 Run the handout/lecture processor over every captured lesson resource, including currently incomplete lesson reviews, and resolve each item to included atoms or an explicit exclusion.
- [x] 5.5 Implement the Knowledge Card processor over governed Canonical-keyed sections and retain source/content identity, paragraph anchors, access state, and launch descriptors.
- [x] 5.6 Run the card processor over the complete captured card inventory and persist actual atom/binding candidates and exclusions rather than relying on coverage counts.
- [ ] 5.7 Implement the infograph/image processor over accepted image hashes and governed description/caption semantics, preserving exact Canonical and launch identities.
- [ ] 5.8 Run the infograph processor over every captured accepted image resource and persist actual atoms/binding candidates, accessibility evidence, and exclusions.
- [ ] 5.9 Add cross-type tests proving that retrieval windows, resource-review rows, filenames, PDFs, and whole-file placeholders cannot substitute for formal semantic atoms.

## 6. Exercises, Simulations, and Interactive Resources

- [x] 6.1 Implement exercise discovery across lesson steps, assessment items, registries, and runtime manifests with stable logical question/task identity.
- [x] 6.2 Materialize one atom per exercise question/task over stem, options, answer, and explanation hashes while keeping answer/scoring payloads out of public graph projections.
- [x] 6.3 Run semantic Canonical mapping for every captured exercise atom, preserve qualification and course-owner decisions, and explicitly exclude blocked or unsupported items.
- [ ] 6.4 Implement simulation and interactive-resource atoms that bind registry identity, subtype, task/scene semantics, versioned configuration, runtime contract, and precise launch anchors.
- [x] 6.5 Run the simulation/interactive processor over every captured governed launcher and resolve missing registry entries, stale configurations, or unlaunchable resources to explicit exclusions.
- [x] 6.6 Validate that formal exercise/simulation bindings do not imply path eligibility, assessment authority, mastery, or learning evidence.

## 7. Canonical Binding and Formal Resource Envelope

- [ ] 7.1 Implement capture-bound Canonical mapping receipts for every atom using stable IDs, semantic revisions, evidence, confidence, teaching role, and qualification identity rather than label similarity alone.
- [ ] 7.2 Apply formal binding gates across all processed resource subtypes and persist included bindings plus item-level rejection reasons.
- [ ] 7.3 Validate exact launchability, access policy, citation/AI-use state, and subtype-specific anchor resolution for every included atom.
- [x] 7.4 Build the complete resource disposition ledger and prove that nodes with zero resources remain valid without placeholders.
- [x] 7.5 Seal the formal resource envelope from actual atom/binding/disposition files and independently reopen every referenced artifact and semantic hash.
- [x] 7.6 Run denominator, subtype, role, source, atom, binding, and launch summaries over the real candidate and reconcile every mismatch before marking the resource layer complete.

## 8. Incremental Invalidation

- [ ] 8.1 Implement content-addressed dependency keys over allocation, source/atom, Canonical revision, role/scope, processor/model/runtime, hotword, segmentation/alignment, mapping, anchor, launcher, and validator identities.
- [ ] 8.2 Implement exact-key reopening and reuse with derived-output dependency tracking and explicit tombstones for removed resources.
- [x] 8.3 Add a clean replay test proving identical semantic hashes for an unchanged captured run.
- [ ] 8.4 Add one-change tests for text, media, hotword, model/configuration, Canonical revision, mapping role, and launcher drift, proving only affected nodes and derivatives are invalidated.
- [ ] 8.5 Add a same-Schema newer-Authority test proving selector generation and incremental resource/projection rebuild require no version-specific adaptation code.
- [ ] 8.6 Add a Schema or consumer-contract drift test that fails closed and reports the need for a separate OpenSpec adaptation change.

## 9. Three-family Teaching-relation Closure

- [x] 9.1 Derive and seal the exact active-domain membership and Canonical semantic revisions from the captured Authority rather than accepting a caller-supplied member array.
- [x] 9.2 Replace synthetic relation qualification fixtures with frozen representative course evidence and real gold/holdout qualification for containment, prerequisite, and pedagogical association.
- [x] 9.3 Generate persisted candidate sets and evidence-registry references for every scoped `canonicalId × family` row.
- [x] 9.4 Implement automatic final inclusion only for exact qualified-pipeline items that pass all item-level evidence gates.
- [x] 9.5 Generate immutable review packs for every low-confidence, conflicting, unsupported, or exceptional candidate without dropping it from the scope denominator.
- [x] 9.6 Conduct course-owner review of all exception packs in repository development and record accept, reject, replace, or evidence-backed `NO_RELATION` decisions; no runtime reviewer role may remain as unfinished work.
- [x] 9.7 Implement the decision applier and persist original candidates, evidence, course-owner decisions, final relations, rejections, replacements, and `NO_RELATION` dispositions.
- [x] 9.8 Validate evidence references against the frozen course sources and reject arbitrary strings, drifting evidence, relabeled Engineering relations, duplicated rows, or cross-capture decisions.
- [x] 9.9 Run the complete captured scope through all three families and reconcile every row until unresolved count is zero and each member-family pair has exactly one valid final disposition.
- [x] 9.10 Seal and independently reopen the three family ledgers, prerequisite publication, review/decision artifacts, and computed closure receipt.

## 10. Complete Teaching Projection

- [x] 10.1 Change projection state derivation so `COMPLETE` can be produced only by validators over reopened membership, three-family ledgers, locale state, formal resource envelope, and allocation identities.
- [x] 10.2 Remove or reject projection and coordination paths that accept a completion state or semantic hash without the matching reopenable artifact.
- [x] 10.3 Build the actual capture-bound Teaching Projection with all included relations, resource bindings, zero-resource nodes, access-safe launch descriptors, and explicit projection limitations.
- [x] 10.4 Materialize independently versioned domain fragments and prerequisite publication from the complete projection.
- [ ] 10.5 Materialize domain shards/overlays and every declared graph, drawer, lesson, or other consumer projection from the same complete identity.
- [x] 10.6 Add validators for Authority membership, relation-family conservation, resource-envelope coherence, locale qualification, fragment/shard membership, launch safety, and semantic-hash recomputation.
- [x] 10.7 Run the real projection build and resolve all missing, partial, stale, or cross-identity derivatives before sealing the projection as complete.

## 11. End-to-end Candidate Acceptance

- [x] 11.1 Add an end-to-end command that starts from the sealed allocation and actual source manifests and produces the resource envelope, relation closure, Teaching Projection, derivatives, and reports without caller-authored inner hashes.
- [x] 11.2 Run the end-to-end command in a clean fixed-revision environment over the complete captured corpus and retain the actual immutable outputs.
- [x] 11.3 Verify denominator conservation, active-baseline continuity, every new-delta disposition, every included atom/binding/launch, every three-family disposition, zero unresolved relations, and every projection derivative from the materialized files.
- [x] 11.4 Run negative acceptance for source, model, hotword, atom, evidence, ledger, envelope, projection, fragment, and selector drift; every case must fail closed or remain non-selectable.
- [x] 11.5 Run privacy/access, exercise-answer isolation, non-teaching atom, zero-resource node, and no-learning-evidence acceptance checks.
- [x] 11.6 Run deterministic clean replay and bounded single-input incremental replay against the final candidate and record timing, reuse, invalidation, and semantic-hash evidence.
- [x] 11.7 Conduct final course-owner sampling across textbooks, handouts, cards, infographs, intro videos, ASR media, exercises, simulations, relation families, and graph consumer outputs; apply all accepted corrections and repeat affected validations.
- [x] 11.8 Run the affected unit/domain suites, `npm run typecheck`, `npm run verify:commit`, `npm run verify:push`, strict OpenSpec validation, and the final full repository verification required by project policy.

## 12. Immutable Handoff and Documentation

- [x] 12.1 Generate the non-selectable remediation handoff manifest binding the shared coordination allocation, Authority, denominator, processor qualifications, source receipts, formal resource envelope, three-family closure, complete Teaching Projection, derivatives, audit reports, and exact semantic hashes.
- [x] 12.2 Verify all production Authority, Teaching Projection, Runtime Release, domain-shard, and consumer selectors remain on their predecessor identities and record the evidence.
- [x] 12.3 Update project and operator documentation with the actual source-maintenance, Fun-ASR-Nano/hotword, incremental-processing, human-review, and regeneration commands and artifact locations.
- [x] 12.4 Audit every checked task against reopenable real-corpus artifacts; leave any framework-only, fixture-only, unprocessed, unreviewed, or unresolved item unchecked.
- [x] 12.5 Make the coordinated-cutover implementation consume and reopen the immutable remediation handoff and its exact shared allocation instead of accepting copied inner hash strings or creating a second allocation, while retaining outer candidate, deployment, and production activation as separate authorities.
- [x] 12.6 Prove the coordinated-cutover candidate recognizes the exact remediation artifacts and remains non-selectable; do not deploy, publish to OSS, or mutate production selectors under this change.
