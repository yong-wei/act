## ADDED Requirements

### Requirement: Intro-video ingestion binds authoritative production provenance
Every formal `intro-video` SHALL be imported through an immutable source manifest that binds the exact Videos repository or external-input identity, unit and composition mapping, production design, script, cues, timeline, referenced assets, final render hash and duration, ACT authoring/runtime target hashes, importer version, and verification result. Filename conventions or an unrecorded ignored workspace render SHALL NOT establish production provenance.

#### Scenario: Production source matches final ACT media
- **WHEN** the production script, cues, timeline, render, and ACT target resolve to the same declared unit and final media hash
- **THEN** the production source SHALL establish transcript and semantic timing authority for that `intro-video`
- **AND** an ASR result SHALL NOT overwrite the verified production source

#### Scenario: Render is found only by filename
- **WHEN** a local render name appears to match a unit but its content hash and source manifest are absent or disagree
- **THEN** the resource SHALL fail formal media admission
- **AND** no source or transcript authority SHALL be inferred from `findings`, `leftover`, unit name, or directory position

### Requirement: Formal course-media ASR uses one exactly qualified Fun-ASR-Nano runtime
Course video, audio, or podcast media without authoritative production scripts SHALL use Fun-ASR-Nano only after the installed LM Studio model and runtime have an immutable qualification receipt. Before holdout results are opened, a pre-registration receipt SHALL bind model identifier and revision, available weight hashes, quantization, LM Studio/runtime and API versions, hardware/backend, decoding and timestamp configuration, hotword request contract, corpus selection policy, calibration/gold and blind-holdout identities, and frozen thresholds. The later qualification receipt SHALL bind that pre-registration, the untouched holdout results, measured metrics, pass/fail outcome, and output hashes. An alternate model, post-hoc threshold, previously inspected holdout, or synthetic smoke sample SHALL NOT satisfy qualification.

#### Scenario: Exact pipeline passes real-course qualification
- **WHEN** the exact Fun-ASR-Nano processor passes thresholds sealed after calibration and before the untouched real Chinese control-theory holdout is opened for transcript errors, terminology recall, false insertions, timestamp monotonicity, duration coverage, and paragraph validity
- **THEN** its matching media outputs MAY enter semantic segmentation and formal binding candidacy
- **AND** every output SHALL retain the exact processor and qualification identity

#### Scenario: Thresholds are selected after holdout inspection
- **WHEN** a threshold, configuration, sample-selection rule, or membership decision is made after holdout results are opened
- **THEN** that holdout SHALL be ineligible to qualify the changed pipeline
- **AND** the changed qualification identity SHALL require a newly sealed untouched holdout

#### Scenario: Installed model or runtime differs
- **WHEN** model revision, weights, quantization, runtime, API contract, decoding parameters, timestamp mode, or hotword behavior differs from the qualification receipt
- **THEN** the prior receipt SHALL NOT authorize the output
- **AND** the affected media and derivatives SHALL remain provisional or excluded until requalified

### Requirement: Media hotword manifests derive from exact handout or lecture truth
Every Fun-ASR-Nano course-media request SHALL use a deterministic versioned hotword manifest derived from the exact frozen handout or lecture source used to produce that media. The manifest SHALL bind source resource and paragraph IDs, source hash, locale, extractor version and configuration, captured terminology identity, normalized terms, safe pronunciation aliases, bounded weights, exclusion reasons, request representation, and manifest hash. It SHALL NOT introduce a term absent from the bound source truth, and hotwords SHALL remain hints rather than forced transcript content.

#### Scenario: Hotword-assisted transcript is produced
- **WHEN** a media item has an exact handout/lecture source binding and a qualified hotword extractor and ASR processor
- **THEN** the request SHALL use the sealed per-resource hotword manifest
- **AND** the receipt SHALL preserve the manifest, exact request representation, response identity, and downstream transcript hash

#### Scenario: Source truth is missing
- **WHEN** a course-media item expected to be handout-derived cannot bind the exact source paragraphs and content hash
- **THEN** the workflow SHALL reject formal ASR admission for that item
- **AND** it SHALL NOT substitute a generic course-wide hotword list

#### Scenario: A hotword dependency changes
- **WHEN** the source paragraph, extraction rule, terminology identity, entry, alias, weight, model, or request contract changes
- **THEN** the transcript, segmentation, alignment, media atoms, and derived bindings SHALL become stale
- **AND** the changed configuration SHALL require matching qualification evidence before formal use

#### Scenario: Hotwords cause unsupported insertions
- **WHEN** paired real-course evaluation shows that a hotword configuration exceeds the frozen false-insertion threshold or otherwise fails balanced quality policy
- **THEN** that configuration SHALL be ineligible for formal processing
- **AND** terminology recall alone SHALL NOT override the failure

### Requirement: Qualified media processing materializes semantic time atoms
For every admitted ASR media item, the system SHALL persist the actual normalized transcript identity, semantic-paragraph segmentation, finite monotonic `startSeconds`, deterministic end derivation from the next start or final duration, confidence and limitation state, Canonical mapping evidence, and complete source/pipeline lineage. A raw whole-file transcript, subtitle filename, or precomputed caller hash SHALL NOT substitute for these atoms.

#### Scenario: Media paragraphs are admitted
- **WHEN** qualified ASR, hotword, segmentation, alignment, and mapping outputs all match the captured media and source identities
- **THEN** the system SHALL materialize ordered semantic-paragraph atoms with precise launch anchors and deterministic ends
- **AND** independent validation SHALL reopen the media, source, receipts, and atom ledger before formal admission

#### Scenario: One paragraph or time anchor is invalid
- **WHEN** a paragraph lacks a stable identity, valid source lineage, monotonic start, deterministic end, mapping evidence, or matching qualification
- **THEN** the affected resource SHALL fail its formal gate
- **AND** the workflow SHALL NOT create a whole-file fallback binding
