## MODIFIED Requirements

### Requirement: Media source manifests are validated before projection
The system SHALL validate media source manifests before generating resource-center or formal-resource projections. A video, audio, or podcast manifest intended for formal inclusion SHALL bind stable source identity, final media hash and duration, script identity/hash, ordered semantic-paragraph IDs and hashes, validated `startSeconds`, a versioned end-derivation rule, exact runtime subtype, graph-binding candidates, scene availability, privacy scope, citation policy, AI-use permission, and the applicable pipeline qualification receipts. Missing or drifting required fields SHALL fail formal eligibility for that resource rather than create a whole-file fallback binding.

#### Scenario: Video or audio manifest is ingested
- **WHEN** a video, audio, or podcast manifest is read from an authoring or source repository
- **THEN** validation SHALL require stable source and final media identity, media type and duration, script identity, ordered semantic paragraphs, finite monotonic start times, graph-binding evidence, scene availability, privacy scope, citation policy, AI-use permission, and exact qualification identity
- **AND** missing or invalid fields SHALL produce bounded limitations and SHALL exclude the affected resource from formal admission

#### Scenario: Slides or image manifest is ingested
- **WHEN** a slides or image manifest is read
- **THEN** validation SHALL require stable page, image, or semantic-text anchors, content identity, text or image descriptions where needed for retrieval, graph-binding evidence, scene availability, citation policy, and AI-use permission
- **AND** missing anchors or descriptions SHALL prevent verified citation readiness and formal admission for affected instructional atoms

#### Scenario: Media paragraph ends are reconstructed
- **WHEN** an ordered media manifest has valid paragraph starts and final media duration
- **THEN** each paragraph end SHALL be derived from the next start or the final duration under the declared rule version
- **AND** stored or derived timing that disagrees with that reconstruction SHALL fail validation

### Requirement: Media manifests project into governed resource semantics
Validated media manifests SHALL project into ResourceSegment, CitationTarget, RetrievalChunk, ResourceSemanticProjection, and formal atomic-binding metadata without bypassing source ownership. The projection SHALL retain only the source/content identities, semantic atom identity, anchor, graph refs, exact subtype, scene and citation states, formal eligibility, qualification lineage, and bounded limitations needed by each consumer. It SHALL NOT copy raw media, transcript bodies, private source-repository details, candidate ledgers, object keys, credentials, or signed URLs into unrelated runtime records.

#### Scenario: Projection is generated
- **WHEN** a media semantic paragraph passes validation
- **THEN** the projection SHALL preserve source and media hashes, paragraph identity/hash, start time and deterministic end rule, graph refs, scene availability, citation readiness, evidence capability, privacy scope, exact subtype, qualification identity, formal eligibility, and limitations
- **AND** raw media, transcript text, hidden source internals, or temporary access URLs SHALL NOT be copied into unrelated runtime records

#### Scenario: Media segment is citation-ready
- **WHEN** a media semantic paragraph has a stable source identity, deterministic anchor, graph binding, citation policy, and formal eligibility
- **THEN** it MAY be cited or retrieved according to existing scope and verification policy
- **AND** it SHALL NOT become a PathNode or formal launch target from citation readiness alone

#### Scenario: Projection is not formally eligible
- **WHEN** a media resource has valid development metadata but fails one formal source, timing, qualification, binding, or launch gate
- **THEN** its development projection MAY retain bounded limitations
- **AND** no formal binding, graph marker, or formal launch descriptor SHALL be emitted

## ADDED Requirements

### Requirement: Media transcript authority follows source-specific qualification
An `intro-video` with a versioned production script and design source SHALL use those sources as transcript authority after verifying them against final media identity. Course video and podcast/audio without an authoritative production script MAY use only an exactly qualified ASR, semantic-segmentation, and time-alignment pipeline. A pipeline receipt SHALL bind versioned representative gold/holdout identities, balanced precision/recall policy, measured results, thresholds, model/algorithm/prompt/configuration, inputs, and output hash.

#### Scenario: Intro source and media agree
- **WHEN** a production script and design record resolve to the exact final `intro-video` hash under the approved source verifier
- **THEN** those records SHALL establish the script identity used for semantic paragraphs
- **AND** an ASR transcript SHALL not overwrite the production source

#### Scenario: Podcast uses qualified ASR
- **WHEN** a podcast has no authoritative script and the exact ASR, segmentation, and time-alignment versions have matching successful qualification receipts
- **THEN** their item-level valid semantic paragraphs MAY enter formal binding candidacy
- **AND** low-confidence, drifted, or invalid paragraphs SHALL still fail the resource's formal gate

#### Scenario: Pipeline qualification is stale
- **WHEN** the model, prompt, algorithm, configuration, threshold, gold/holdout, or source-processing rule changes
- **THEN** the prior qualification receipt SHALL not authorize new formal paragraphs
- **AND** previously selected production content SHALL remain unchanged until a separately qualified candidate is activated
