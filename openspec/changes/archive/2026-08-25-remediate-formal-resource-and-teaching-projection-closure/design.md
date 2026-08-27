## Context

The archived formal-resource change established schemas, builders, validators, and small qualification fixtures, but it did not execute the course corpus. Its atom builders accept pre-segmented paragraphs or questions, its media validators accept caller-provided source identities and receipts, and its tests use synthetic inputs. The current coordinated-cutover implementation similarly accepts hashes and already-closed relation ledgers; it does not extract source material, run ASR, apply human decisions, build a formal resource envelope, or generate a Teaching Projection.

The investigation snapshot demonstrates that this is a production-data and processing closure problem, not a missing UI feature:

| Area | Current evidence | Missing formal result |
| --- | --- | --- |
| `intro-video` | 31 ACT authoring/runtime files have unique byte-identical matches in local Videos renders; each Videos unit contains composition, design, timeline, captions, outline, and cues | Immutable cross-repository provenance and verified semantic atoms |
| Textbooks | 7 structured runtime sets and 24,578 stable fragment anchors | Formal bindings and envelope admission |
| Handouts | 32 resources in the current projection, all `EXPLICIT_NONE` | Semantic-paragraph atoms and Canonical bindings |
| Cards / infographs | 838 runtime cards and 161 accepted infographs | Formal resource atoms, bindings, and launch descriptors |
| Exercises | 576 governed items; only a subset is reviewed/path-eligible and many are blocked | Per-question formal mappings and explicit exclusion ledger |
| Teaching relations | The v0.22 investigation snapshot has 7,300 scope members and 21,900 pending three-family rows | Applied decisions, final dispositions, zero-unresolved closure, and complete projection |
| Runtime | Production remains on v0.9 with no active Teaching Projection | A qualified non-selectable successor candidate |

These counts are diagnostic only. The execution-time capture and denominator manifests are authoritative and may contain newer versions or counts.

The course owner is the only reviewer. Review occurs through repository artifacts during execution; no runtime role, database workflow, or project-service review surface is needed.

Fun-ASR-Nano is being downloaded through LM Studio. The model is an intended processor, not yet a qualified dependency. Its exact model identity, artifact hashes, LM Studio/runtime version, API behavior, hotword parameter contract, and timestamp behavior must be frozen from the installed instance before formal processing begins.

## Goals / Non-Goals

**Goals:**

- Produce one real, reproducible, capture-bound formal resource envelope from the declared successor Runtime Release denominator.
- Import authoritative `intro-video` production sources and process other course media with a qualified Fun-ASR-Nano pipeline.
- Derive a per-resource hotword manifest from the exact handout or lecture truth used to create each course video or audio item.
- Materialize real semantic paragraphs, question/task atoms, Canonical bindings, precise launch anchors, and complete disposition ledgers for every included or excluded resource.
- Reuse unchanged work incrementally while invalidating every result whose semantic or processing dependencies drift.
- Complete all three ACT teaching-relation families, apply course-owner decisions, and generate the actual complete Teaching Projection and consumer artifacts.
- Produce a qualified but non-selectable handoff bundle that the coordinated cutover can verify and consume.

**Non-Goals:**

- Do not modify ActKG Engineering Authority or invent relations to obtain coverage.
- Do not require every Canonical node to have a resource; only resources in the declared release denominator require a final disposition.
- Do not add a runtime reviewer role, review service, or multi-teacher workflow.
- Do not activate Authority, Teaching Projection, Runtime Release, OSS, domain-shard, or consumer selectors.
- Do not publish or deploy the candidate, retire production resources, or authorize the coordinated cutover.
- Do not treat retrieval chunks, resource binding, launch, or playback as path eligibility, mastery, or learning evidence.

## Decisions

### 1. Create a remediation change and preserve prior history

The archived formal-resource change remains an accurate record of the framework that was merged. Reopening it would rewrite the meaning of historical completion, while expanding the coordinated cutover would violate that change's explicit non-goal of replacing resource atomization and media processing.

This change therefore owns the missing source processors, actual course execution, relation-decision application, projection materialization, and evidence-backed completion. The coordinated cutover is a downstream consumer and SHALL be marked as blocked by this change. Its implementation cannot use the archived framework or caller-supplied hashes as evidence that this remediation has completed.

Alternative considered: append the work to the coordinated cutover. Rejected because it would combine corpus production, qualification, immutable envelope construction, selector coordination, deployment, and activation in one authority boundary.

### 2. Seal the shared coordination allocation before processing

Execution starts by sealing the exact coordination allocation record required by `coordinate-latest-authority-and-active-oss-cutover`. The remediation and downstream paths SHALL reuse one schema and validator rather than maintain parallel allocation shapes. This change owns that prerequisite offline allocation and its resource/teaching inner artifacts; the downstream change owns the later outer candidate, deployment, and activation authorities. The allocation contains at least:

- an opaque unique coordination run ID;
- the exact compatible formal ActKG composite capture, Schema/consumer-contract identity, component versions, commit, and hashes;
- the explicit compatibility result and sealed target-course active-domain scope identity/hash;
- the active OSS Runtime Release identity plus the explicitly declared new or changed inputs that form the successor denominator;
- locale and terminology identities used for mapping and hotword normalization;
- source-repository capture identities or content-addressed external-input manifests;
- the exact policy versions, implementation identities, processor registry, validator rules, and course-owner identity used for repository decisions.

Every manifest, atom, receipt, decision, binding, fragment, envelope, and summary closes over this allocation ID. The downstream coordinator SHALL reopen and reuse this same allocation; it SHALL NOT create a second allocation for the handoff. If the intended Authority or denominator changes before coordination, the system seals a new shared allocation and reruns remediation incrementally before any outer candidate is built. It cannot relabel the old result or rebind immutable inner artifacts.

Dirty or ignored workspace paths are discovery locations, not authority. Governed external inputs are copied or represented through immutable content-addressed manifests before processing. Local absolute paths are retained only in private execution logs and never in public runtime artifacts.

### 3. Treat processing as a ledgered resource-maintenance run

The execution engine walks the frozen denominator and writes one final resource record per logical resource. Each resource record has one of two final dispositions in a completed run:

- `INCLUDED`: every atom has a final atom disposition, at least one instructional atom is `BOUND`, every required binding and launch anchor is materialized, and the resource passes its formal gate;
- `EXCLUDED`: the resource remains available only where existing development policy allows, with structured failure codes and evidence.

Within an included resource, identified atoms such as title cards or copyright segments may receive an evidenced `NON_TEACHING` atom disposition and do not require fabricated Canonical mappings.

Continuity policy constrains those outcomes. Every teaching resource in the production-active baseline must remain `INCLUDED` unless the course owner records an exact evidence-bound retirement. A technical source, recognition, segmentation, mapping, anchor, or launcher failure leaves the remediation run incomplete; it cannot be converted into `EXCLUDED` or retirement. A failed resource from the explicit new-resource delta may be `EXCLUDED` and remain development-only without weakening the baseline.

No denominator row may disappear between discovery, processing, summary, and envelope construction. A Canonical node may have zero resource rows. A resource may bind multiple nodes, and each role is recorded per binding rather than inferred from subtype.

Completion is derived from actual artifact discovery and hash reopening. The existence of an interface, fixture, hand-authored receipt, caller-provided hash, or synthetic gold/holdout record does not count as processed inventory.

### 4. Import `intro-video` truth from Videos without ASR overwrite

For each unit, a source importer resolves the Videos project and records:

- Videos repository revision and a content manifest for the exact composition, design, timeline, captions, outline, cues, and referenced assets;
- composition ID and unit mapping;
- final render hash and duration;
- ACT authoring and runtime target identities and their byte hashes;
- the verified script/cue/timeline version used to derive semantic paragraphs;
- importer version, verification result, and limitations.

The 31 current hash matches are evidence for the initial run, not a permanent filename rule. Render selection uses the final media hash and explicit unit mapping, never `findings`/`leftover` naming alone. When production script and final media agree, that script is transcript authority. ASR may be used only as a diagnostic comparison and cannot replace it.

Alternative considered: use the existing ACT MP4 alone as truth. Rejected because it cannot establish script/design lineage or reproduce paragraph timing.

### 5. Freeze and qualify Fun-ASR-Nano as one exact local processor

The formal ASR adapter targets the locally served Fun-ASR-Nano instance through LM Studio. Before use, it records the model identifier and revision, weight-file hashes where available, quantization, runtime and API versions, hardware/backend, decoding parameters, hotword request shape, timestamp mode, and normalized response contract. A different model, runtime, quantization, or request contract is a different processor identity and requires a new qualification receipt.

Qualification uses frozen real Chinese control-theory course-video/audio samples with manually checked transcripts and time anchors. Before formal evaluation, the course owner seals the corpus selection policy, calibration/gold membership, blind-holdout membership and reference hashes, and rules preventing result inspection. The implementer runs only the calibration/gold split to select the exact pipeline configuration and thresholds, then seals a pre-registration receipt over them and the already-frozen holdout identity. Only afterward may the holdout evaluator open the reference results and run the one-time formal comparison.

The evaluation compares identical decoding with and without hotwords and measures at least character/word errors, substitutions, deletions, terminology recall, false hotword insertions, timestamp monotonicity, duration coverage, and paragraph boundary validity. Formal admission requires the pre-registered thresholds to pass on the untouched holdout. Any threshold, selection policy, sample membership, model, runtime, hotword, segmentation, or alignment change creates a new qualification identity and requires a new untouched holdout; the failed holdout cannot be reused for tuning. A smoke test or synthetic phrase is insufficient.

Whisper tiny may remain a diagnostic smoke tool, but it is not a silent formal fallback. Processor substitution requires a separately qualified receipt.

### 6. Derive hotword manifests from exact handout truth

Every ASR-processed course video, audio item, or podcast binds the exact frozen handout or lecture source from which it was produced. A deterministic versioned extractor parses semantic Markdown, normalizes Chinese and Latin terminology, deduplicates entries, and assigns bounded weights. It may use the captured terminology registry to recognize aliases or pronunciation forms, but it cannot introduce a term absent from the bound handout/lecture truth.

Each hotword manifest records:

- source resource ID, paragraph IDs, source hash, and locale;
- extractor/version/configuration and terminology-registry identity;
- normalized terms, optional safe pronunciation aliases, bounded weights, and exclusion reasons;
- manifest hash and the exact ASR request field derived from it.

Formula or symbol aliases are included only when their spoken form is explicit in source evidence or a captured governed terminology mapping. Generic high-frequency words, ambiguous abbreviations, and unsafe expansions are excluded. Hotwords are decoding hints: they cannot force transcript text, repair evidence after the fact, or authorize low-confidence output. Source paragraph, extractor, registry, term, weight, model, or request drift invalidates the transcript and every downstream segmentation, alignment, atom, and binding.

If a resource expected to be handout-derived has no exact source binding, it fails formal ASR admission instead of receiving a generic course-wide hotlist.

### 7. Use type-specific source processors and stable atoms

The pipeline reuses existing stable structures where they are valid and adds processors only at the missing boundary:

- textbook: reuse the structured v2 fragment anchors and validate source/locator identity before emitting paragraph atoms;
- handout/lecture: parse authoring Markdown as semantic truth; treat exported PDF as a launch derivative bound to the Markdown and page/paragraph locator where available;
- Knowledge Card: segment governed semantic sections while preserving Canonical-keyed identity;
- infograph/image: bind the accepted image hash together with its governed description/caption atom and launch target;
- course video/audio/podcast: run qualified ASR, semantic paragraph segmentation, and timestamp alignment, deriving each end from the next start or media duration;
- exercise: hash one question/task atom over the complete stem, options, answer, and explanation, then map it semantically without exposing answer payloads in graph projections;
- simulation/interactive resource: bind the governed registry identity, task or scene semantics, versioned configuration, and precise launch anchor without inventing a text transcript.

Text windows, retrieval chunks, existing resource-review rows, filenames, and whole-file fallbacks cannot substitute for formal atom identity.

### 8. Make incremental reuse dependency-complete

Each processing node has a content-addressed cache key over all semantically relevant dependencies: allocation, source and atom hashes, Canonical semantic revision, relation role and scope, source processor, model/runtime/quantization, hotword manifest, segmentation/alignment rules, mapping qualification, anchor contract, launcher identity, and validator version.

An unchanged complete key reopens and revalidates the prior immutable output. A changed key invalidates that node and all derived outputs while leaving unrelated resources reusable. Removed resources receive explicit tombstone/disposition rows. Repeating a clean capture produces identical semantic hashes; changing one source proves bounded invalidation in acceptance tests.

Same-Schema data and resource updates use this incremental run without a new OpenSpec change. Public Schema, durable artifact shape, or consumer-contract changes fail closed and require a separate adaptation proposal.

### 9. Apply relation decisions before deriving projection completeness

The relation workflow derives the exact active-domain scope from the captured Authority, records each `canonicalId × family` candidate set, and runs the qualified automatic pipeline. Evidence-qualified relations receive final candidate dispositions. Low-confidence, conflicting, or otherwise problematic items enter immutable repository review packs containing the source revision, semantic evidence, candidate rationale, and proposed alternatives.

The course owner reviews exceptions during development and records accept, reject, replace, or evidence-backed `NO_RELATION` decisions. A decision applier validates references and materializes the final ledgers. It cannot rename Engineering relations as teaching relations, fabricate edges, or accept an unbound evidence string. All candidates, decisions, and final dispositions remain available for audit.

`COMPLETE` is computed only when containment, prerequisite, and pedagogical association each have exactly one valid final disposition for every scoped member and unresolved count is zero. It is not a writable input field. Qualified relations are active only inside the non-selectable candidate; excluded problems remain in the review/audit package and do not leak into runtime.

### 10. Materialize a complete non-selectable handoff bundle

The projector consumes only reopened remediation artifacts and writes:

- formal resource atoms, bindings, disposition ledger, and sealed resource envelope;
- three family ledgers, review/decision artifacts, closure receipt, and prerequisite publication;
- ACT Teaching Projection, independently versioned domain fragments, domain shards/overlays, and declared consumer projections;
- qualification, integrity, denominator-accounting, privacy, launchability, and reproducibility reports;
- one handoff manifest that binds every path, artifact ID, semantic hash, allocation, capture, and non-selectable state.

Validators recompute hashes from files, prove denominator conservation and relation-family closure, reject drift or unknown state, and confirm that all production selectors still reference the predecessor combination. The coordinated cutover must consume the handoff manifest and reopen its members; copying hash strings into its input is not evidence.

## Risks / Trade-offs

- [Fun-ASR-Nano or LM Studio lacks adequate timestamp/hotword behavior] → Freeze capabilities before implementation, run real-media qualification, and fail formal admission until a qualified processor/alignment combination exists.
- [Hotwords improve terminology recall but create false insertions] → Compare paired runs, bound weights, measure insertion errors explicitly, and admit only the qualified configuration.
- [Videos render files are ignored and the repository is dirty] → Convert discovered files into immutable external-input manifests or governed imports before processing; never use workspace cleanliness assumptions as provenance.
- [Large relation scope creates substantial human review work] → Automatically admit only qualified items, cluster exceptions without hiding denominator rows, preserve resumable review packs, and require course-owner final decisions before closure.
- [Existing resource projections are mistaken for formal atoms] → Require type-specific atom validators and reject retrieval windows or review rows that lack formal identity and launch anchors.
- [Candidate artifacts consume significant storage] → Use content-addressed incremental outputs and reuse unchanged blobs; retention/GC must preserve every referenced candidate and predecessor.
- [Remediation and coordinated-cutover captures drift] → Bind both to exact identities; mismatch triggers an incremental remediation run, never pointer relabeling.

## Migration Plan

1. Seal the shared coordination allocation, Authority capture, successor denominator, source registries, and processor registry in a clean capture context.
2. Import the Videos provenance manifests and verify all `intro-video` source/final-media/ACT-target identities.
3. Freeze the installed Fun-ASR-Nano/LM Studio identity, build handout-derived hotword manifests, pre-register the calibration/holdout protocol and thresholds, then qualify ASR, segmentation, and alignment on the untouched holdout.
4. Run all text, media, exercise, card, infograph, simulation, and interactive-resource processors; resolve every denominator resource to `INCLUDED` or `EXCLUDED` and every included atom to `BOUND` or evidenced `NON_TEACHING`, while treating any technical failure in a non-retired active-baseline resource as incomplete.
5. Materialize bindings and seal the formal resource envelope, then reopen it through independent validators.
6. Generate all three relation-family candidates, perform course-owner review, apply decisions, and prove zero unresolved items.
7. Build and independently validate the complete Teaching Projection, fragments, shards, consumer projections, and non-selectable handoff bundle.
8. Register the immutable handoff as the native prerequisite of the coordinated cutover. No deployment or selector mutation occurs in this change.

Rollback is deletion of unselected working pointers and regeneration from the last sealed shared allocation; immutable evidence is retained for audit. Production needs no rollback because this change never mutates active selectors or runtime deployment.

## Open Questions

There are no unresolved architecture choices. Execution must record the downloaded Fun-ASR-Nano model/revision, LM Studio version, supported hotword/timestamp request contract, real-course qualification thresholds, and final capture versions as evidence facts before the corresponding gates can pass.
