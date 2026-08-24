# formal-runtime-atomic-resource-binding Specification

## Purpose
TBD - created by archiving change gate-formal-runtime-resources-on-canonical-bindings. Update Purpose after archive.
## Requirements
### Requirement: Formal Runtime candidate denominator is frozen and disposition-complete
The formal resource gate SHALL derive one deterministic candidate inventory from every Git-managed or declared external/generated resource intended for the target Runtime Release v2. Every candidate SHALL bind a stable resource identity, exact runtime subtype, course scope, source and content identity, and exactly one final `INCLUDED` or `EXCLUDED` disposition. Candidate, included, and excluded sets SHALL each have canonical counts and hashes; exclusion MUST NOT remove an item from the denominator.

#### Scenario: Resource fails atom generation
- **WHEN** a candidate resource lacks a valid transcript, paragraph, question item, anchor, or source identity
- **THEN** the resource SHALL remain in the candidate ledger with an `EXCLUDED` disposition and bounded failure reasons
- **AND** it SHALL NOT enter the formal manifest or disappear from candidate counts

#### Scenario: Candidate inventory is rebuilt
- **WHEN** identical source revision, external declarations, inventory rules, and inputs are processed twice
- **THEN** candidate order, dispositions, set hashes, and counts SHALL be byte-identical

#### Scenario: Working directory contains another file
- **WHEN** an untracked, undeclared, or out-of-scope working-tree resource is present
- **THEN** it SHALL neither enter nor alter the formal candidate inventory
- **AND** the release builder SHALL continue to use only the frozen Git and declared external/generated identities

#### Scenario: Frozen release entry is not classified
- **WHEN** a logical-tree or governed external-input entry has neither a registered resource classification nor an explicit non-resource classification under the inventory contract
- **THEN** formal inventory completeness SHALL fail before publication
- **AND** the entry SHALL NOT be omitted silently to reduce the candidate denominator

### Requirement: Formal teaching resources are atomically bound or explicitly non-teaching
Every atom in an included formal resource SHALL have stable identity, parent resource, exact subtype, source/content hash, course scope, anchor, and either one or more valid Canonical bindings or an audited `NON_TEACHING` disposition. Every included teaching resource MUST contain at least one `BOUND` atom. A Canonical Object MAY have no bound resource without causing the release to fail.

#### Scenario: Media contains an instructional paragraph and an intro
- **WHEN** the instructional semantic paragraph has a valid Canonical binding and the intro has an evidence-bearing `NON_TEACHING` disposition
- **THEN** the resource MAY be included when every other atom and release gate passes
- **AND** the non-teaching intro SHALL not create a fabricated Canonical relation

#### Scenario: Teaching resource has no bound atom
- **WHEN** every atom is unresolved, excluded, or marked non-teaching
- **THEN** that teaching resource SHALL be excluded from the formal manifest
- **AND** development runtime MAY retain it with its candidate disposition

#### Scenario: Canonical node has no resource
- **WHEN** an in-scope Canonical Object has zero formal bindings
- **THEN** the resource gate SHALL remain valid when every candidate resource is otherwise disposition-complete
- **AND** it SHALL not create a placeholder resource or fail node coverage

### Requirement: Media and text atoms use deterministic semantic anchors
Video, audio, and podcast binding atoms SHALL be semantic paragraphs with validated `startSeconds`; each end SHALL be derived from the next paragraph start or final media duration using a versioned rule. Textbook, Knowledge Card, handout, lecture, slide text, and other text-bearing atoms SHALL be stable semantic paragraphs. An exercise atom SHALL be one stable question or task item.

#### Scenario: Media paragraphs are valid
- **WHEN** ordered paragraph starts are finite, non-negative, strictly increasing, within the identified media duration, and bound to script and paragraph hashes
- **THEN** every paragraph end SHALL be deterministically derived from the next start or final media duration
- **AND** rebuilding with the same media, script, segmentation, timing rule, and duration SHALL produce identical anchors

#### Scenario: Media timing is invalid
- **WHEN** a paragraph start is missing, duplicate, decreasing, out of range, or bound to another media or script identity
- **THEN** the entire media resource SHALL fail formal eligibility
- **AND** no whole-file fallback binding SHALL replace the invalid atomic anchors

#### Scenario: Text paragraph changes
- **WHEN** a text resource is re-segmented
- **THEN** only paragraphs whose stable IDs and content hashes are unchanged MAY retain their prior bindings
- **AND** every added, removed, or changed paragraph SHALL be re-dispositioned

#### Scenario: Exercise content changes
- **WHEN** a question stem, option, answer, or explanation changes
- **THEN** that question atom's binding SHALL become stale and require regeneration

### Requirement: Qualified source-specific pipelines produce admissible atoms and bindings
ASR, semantic segmentation, time alignment, and Canonical mapping pipeline versions SHALL each require a successful qualification receipt over frozen representative gold/holdout artifacts and a recorded balanced precision/recall policy. Item-level identity, evidence, confidence, anchor, role, scope, and endpoint gates SHALL remain mandatory after pipeline qualification. `intro-video` SHALL prefer its production script and design source verified against final media identity; course video and podcast/audio SHALL use qualified ASR when no authoritative script exists.

#### Scenario: Intro production script is available
- **WHEN** the production project supplies a versioned script and design source for an `intro-video`
- **THEN** the pipeline SHALL verify those sources against the final media identity and use them as transcript authority
- **AND** an ASR output SHALL NOT overwrite them as the binding source

#### Scenario: Course podcast has no script
- **WHEN** a podcast or course video has no authoritative production transcript
- **THEN** only an exactly qualified ASR, segmentation, and time-alignment pipeline MAY generate admissible semantic paragraphs
- **AND** each item SHALL still pass its own confidence, evidence, timing, and identity checks

#### Scenario: Pipeline configuration changes
- **WHEN** a model, prompt, algorithm, threshold, segmentation, alignment, or mapping configuration changes
- **THEN** the prior qualification receipt SHALL not authorize the changed version
- **AND** its generated atoms or bindings SHALL remain non-formal until the new version qualifies

### Requirement: Formal binding roles and media types are orthogonal
Every formal binding SHALL use exactly one existing teaching role—`COVERS`, `EXPLAINS`, `PRACTICES`, or `ASSESSES`—while separately preserving the resource's exact runtime subtype and visual family. Binding identity SHALL include the resource atom, Canonical Object, role, and course scope. Media or presentation verbs MUST NOT replace teaching roles.

#### Scenario: One video paragraph explains one concept
- **WHEN** a qualified video atom is admitted as explanatory evidence for one Canonical Object
- **THEN** the binding SHALL use `EXPLAINS` and retain the exact video subtype
- **AND** it SHALL not introduce a `WATCHES` teaching role

#### Scenario: One atom serves different nodes differently
- **WHEN** the same stable atom validly explains one Canonical Object and practices another within the same course scope
- **THEN** the system SHALL emit separate deterministic `EXPLAINS` and `PRACTICES` bindings
- **AND** both SHALL preserve the same resource and atom identities

### Requirement: Resource failure closes locally and formal projection is access-safe
Failure of source identity, atomization, timing, pipeline qualification, Canonical mapping, binding completeness, safe launch target, or anchor consumption SHALL exclude that resource from the formal manifest while allowing unrelated eligible resources to continue. The runtime graph projection SHALL include only current formal resources whose Runtime Release, Authority, binding revision, and viewer access match, and SHALL expose only safe presentation and source-owned launch fields.

#### Scenario: One resource fails and others pass
- **WHEN** one candidate media file has invalid timing while unrelated resources satisfy every formal gate
- **THEN** the invalid media SHALL remain excluded with reasons and the other resources MAY enter the candidate release
- **AND** candidate, included, excluded, and binding hashes SHALL reflect the complete result

#### Scenario: Development resource has a historical binding
- **WHEN** a resource is development-only, excluded, stale, identity-mismatched, or unauthorized even though an older binding exists
- **THEN** the runtime graph SHALL show no marker or drawer launch for that resource
- **AND** the historical record SHALL not establish current formal eligibility

#### Scenario: Formal resource is projected
- **WHEN** an authorized current formal resource is bound to a selected node
- **THEN** the product projection SHALL include safe title, exact subtype, visual family, teaching role, atomic anchor summary, and source-owned launch descriptor
- **AND** it SHALL include no transcript body, candidate ledger, confidence, review state, internal path, object key, or signed URL

