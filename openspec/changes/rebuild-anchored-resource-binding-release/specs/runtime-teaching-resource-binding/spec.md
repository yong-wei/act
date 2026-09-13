## MODIFIED Requirements

### Requirement: Lesson and step inventory feeds the restage
The binding release build MUST consume the active lesson/step inventory together with each lesson's `sequence.json` step-to-node groups and the course-node crosswalk, so that published steps appear as anchored `step` resources bound only to the canonical nodes of their own group. Lesson entry pages (`act:lesson:<unit>`) MUST NOT be projected as resources. A build that omits the active inventory, the sequence groups, or the crosswalk MUST fail closed rather than publish a binding release without step resources or with unit-wide fan-out.

#### Scenario: Published step is inventoried
- **WHEN** the active inventory lists a published lesson step and `sequence.json` places it in a group whose course nodes resolve through the crosswalk
- **THEN** the build SHALL project the step resource with a `step` anchor bound to exactly those canonical nodes
- **AND** it SHALL NOT bind the step to other nodes of the same unit

#### Scenario: Inventory or sequence input is missing
- **WHEN** the build runs without the active lesson/step inventory, a lesson's `sequence.json`, or the course-node crosswalk
- **THEN** it SHALL fail closed
- **AND** it SHALL NOT publish a binding release

#### Scenario: Lesson entry appears in inventory
- **WHEN** the active inventory lists a lesson entry resource
- **THEN** the build SHALL exclude it from `resources.jsonl` and record `entry-excluded` in the gate findings

## ADDED Requirements

### Requirement: Multi-knowledge runtime files bind through anchors
Handout, audio, video, podcast, and textbook runtime files MUST enter the binding release only through per-anchor bindings (heading, time, section). Whole-file bindings of these subtypes to canonical nodes MUST NOT be emitted. Files without any reviewed or automatically derived anchor MUST be listed in the gate report as `no-anchor` and MUST NOT count as bound.

#### Scenario: Whole-book textbook row is encountered
- **WHEN** the textbook channel yields a book-level `act:textbook:<book>` row
- **THEN** the build SHALL drop it and keep only `textbook-section` rows

#### Scenario: Audio file has semantic segments
- **WHEN** a lesson audio has runtime transcript segments with node candidates
- **THEN** the build SHALL emit one `time`-anchored binding per segment-node pair
