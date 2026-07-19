## ADDED Requirements

### Requirement: Resource entities and atomic boundaries are explicitly typed
The manifest SHALL distinguish `course`, `course_module`, `lesson`, `lesson_item`, `resource`, `resource_container`, `registry_entry`, `runtime_projection`, `assessment`, `activity`, `citation`, and `source`, each in a separate identity namespace. It SHALL recursively segment every container into non-overlapping leaf units. Sibling content blocks, activity cards, checkpoints, questions, and media segments MAY all be atoms; every leaf SHALL belong to exactly one atom or unresolved-boundary record, while parents are derived containers.

#### Scenario: An atomic boundary cannot be determined
- **WHEN** source semantics do not identify an independent unit
- **THEN** an explicit unresolved-boundary review item SHALL be emitted
- **AND** coverage SHALL remain incomplete.

#### Scenario: A long document has no locatable internal unit
- **WHEN** the document can only be taught as a whole
- **THEN** the whole document MAY be one atomic `teaches` unit
- **AND** it SHALL NOT create fine-grained `assesses` evidence.

#### Scenario: One interactive step combines explanation, practice, and checkpoint
- **WHEN** recursive segmentation reaches independently meaningful siblings
- **THEN** the content block, activity card, and checkpoint SHALL become separate non-overlapping atomic units
- **AND** their activity order and common container SHALL be preserved.

### Requirement: Atomic units and binding candidates have separate cardinalities
Each `atomic_unit` or unresolved-boundary record SHALL include `atomic_unit_id`, `entity_type`, `identity_namespace`, `container_ref`, `sequence_position`, `source_locator`, `content_digest`, `objective_refs`, closed `audience` (`student`, `teacher`, or `shared`), visibility, and provenance, and each inventoried leaf SHALL appear exactly once. Interactive units SHALL also preserve feedback semantics, misconception tags, teacher aggregation, and teacher progression conditions when present. A separate `binding_candidate` SHALL include `atomic_unit_id`, candidate `component_id`, one `instructional_role`, inherited audience/visibility, role-specific evidence, provenance, owner block, and endpoint blocks. Candidate key SHALL be `(atomic_unit_id, component_id, role)`; each unit MAY have zero or more candidates, and unresolved roles SHALL use explicit review records. Teacher-only units SHALL NOT enter student learning paths, student recommendations, or student-visible knowledge-card resource lists.

#### Scenario: A container coverage summary is emitted
- **WHEN** all child atomic records are known
- **THEN** coverage SHALL be derived only from those children
- **AND** the container SHALL NOT become an independent binding truth.

#### Scenario: A teacher handout contains answers or intervention guidance
- **WHEN** its atomic units are bound to concepts
- **THEN** their audience SHALL remain `teacher`
- **AND** student-facing path, recommendation, and resource projections SHALL exclude them.

### Requirement: Planning, review, and projection evidence cannot become resources
The manifest SHALL apply the instructional source-role matrix. BOPPPS plans, multimedia plans, interactive page designs and contracts, acceptance/review files, and runtime projections SHALL provide only objective, order, feedback, review-gate, or projection-consistency evidence and SHALL NOT directly create `atomic_unit` or `binding_candidate` records. Eligible atoms SHALL originate from authored content blocks, authored resources, authored knowledge cards or media segments, or normalized actual activity/assessment records whose authoring page, authoring contract, runtime manifest, page check, implementation acceptance, manifest audit, and required lesson review agree.
Any identity/order/archetype/feedback/progression drift, failed hard gate, duplicated prompt, missing feedback semantics, or degradation of drag, linking, or exploration behavior to a static image, single choice, or mechanical fill-in SHALL emit `unresolved` or `blocked` and SHALL forbid a formal binding candidate.

#### Scenario: BOPPPS contains a teacher progression instruction
- **WHEN** atomic resource derivation reads the plan
- **THEN** the instruction MAY support sequence or teacher-progression evidence
- **AND** it SHALL NOT become an instructional resource or binding candidate.

#### Scenario: Runtime interaction semantics are weaker than the accepted design
- **WHEN** authoring and runtime reconciliation detects degradation or a non-passing review gate
- **THEN** the normalized activity SHALL be unresolved or blocked
- **AND** no formal knowledge binding SHALL be emitted.

### Requirement: Interaction objectives, feedback, and progression are machine-checkable
Every `teaches`, `practices`, or `assesses` interactive candidate SHALL contain at least one resolvable formal-objective or `course-scope-anchor/v1` reference and SHALL prove consistency among the objective, candidate concept, learner action, expected output, and assessment criterion. Feedback SHALL define trigger state, learner-response state, outcome, corrective action, and next-task reference. Teacher progression SHALL define `hold`, `release`, `retry`, or `teacher_override`, its condition and evidence reference; an override SHALL record actor role, reason, and time.
Authoring page, authoring contract, runtime manifest, page check, implementation acceptance, and manifest audit SHALL reconcile lesson/step/activity/assessment identities, objective refs, interaction archetype, sequence, learner action/output, feedback, misconceptions, teacher aggregation, and teacher progression. Missing fields, unresolved references, mismatches, or hard-gate failure SHALL emit `unresolved` or `blocked` and SHALL forbid a formal binding candidate.

#### Scenario: An activity has prose feedback but no corrective transition
- **WHEN** interaction semantics are validated
- **THEN** the activity SHALL remain unresolved or blocked
- **AND** it SHALL NOT be treated as a complete practice or assessment binding.

### Requirement: Instructional roles use canonical values
Role candidates SHALL use `teaches`, `practices`, `assesses`, or `references`, with documented Chinese display mappings. Legacy explaining semantics SHALL map to `teaches`; values containing slashes or other legacy role names SHALL be rejected.
Role evidence SHALL be discriminated: `teaches` cites a definition, explanation, demonstration, or worked-example locator; `practices` records the learner action, target concept, and expected output; `assesses` records the observable response, criterion, scoring rule, and evidence source; `references` records citation-only location and SHALL NOT claim instruction or assessment.

#### Scenario: Knowledge-card sources are reconciled
- **WHEN** authoring card, runtime projection, and card sequence are present
- **THEN** their identity and content digests SHALL be checked for projection consistency
- **AND** authoring SHALL remain the editable truth.

#### Scenario: Raw, processed, and runtime media coexist
- **WHEN** media source roles are classified
- **THEN** raw files SHALL be provenance only, processed files SHALL be authoring binding content, and runtime files SHALL be projection-consistency evidence
- **AND** a runtime projection SHALL NOT replace missing processed authoring truth.

### Requirement: Resource queue output is private and reproducible
Records SHALL follow the shared future-child schema, including `schema_version`, `algorithm_version`, `normalization_profile`, typed exact items, structured `source_digests`, `governance_contract_digest`, `source_snapshot_digest`, structured `upstream_manifest_digests`, dependencies, owners/endpoints, required outputs, acceptance profile, and scope anchors. They SHALL follow privacy minimization rules, use synthetic fixtures, and provide deterministic/no-write tests.

#### Scenario: A learner-linked source is inventoried
- **WHEN** resource evidence references learner datasets
- **THEN** only dataset-level schema, counts, and small-cell-suppressed aggregate disposition statistics SHALL enter repository artifacts
- **AND** no raw row or row digest SHALL be committed.
