# smart-interactive-courseware-authoring Specification

## Purpose
TBD - created by archiving change add-smart-courseware-generation-editor. Update Purpose after archive.
## Requirements
### Requirement: Courseware generation starts from an approved plan revision
The system SHALL generate interactive courseware only from an immutable approved lesson-plan revision and SHALL preserve that exact baseline.

#### Scenario: Teacher starts courseware generation
- **WHEN** the teacher selects an approved lesson-plan revision and starts courseware generation
- **THEN** the courseware draft and generation job SHALL record that plan revision id, plan version number, and content hash
- **AND** generation SHALL use its confirmed goals, BOPPPS flow, timing, step outline, sources, and limitations as the content boundary.

#### Scenario: Courseware generation attempts to redesign the plan
- **WHEN** generated output changes confirmed goals, removes a required BOPPPS stage, or changes total lesson duration
- **THEN** schema validation SHALL reject the output
- **AND** the failure SHALL remain local to the affected generation stage or module.

### Requirement: Generated courseware conforms to the standard slide runtime
Generated courseware SHALL use the registered BOPPPS stage, courseware step, and module hierarchy defined by `generated-courseware-slide-runtime`.

#### Scenario: Complete courseware is generated
- **WHEN** a courseware draft reaches complete status
- **THEN** all six BOPPPS stages SHALL appear in order
- **AND** every step, module, layout, timing value, and activity response SHALL pass the shared runtime schema.

#### Scenario: A stage needs multiple teaching moments
- **WHEN** a BOPPPS stage, including participatory learning, requires several activities or explanations
- **THEN** generation SHALL create multiple ordered steps when needed
- **AND** each step SHALL retain its own title, duration, layout, modules, and stage identity.

### Requirement: Required BOPPPS activity stages are executable
Pre-assessment, participatory learning, and post-assessment SHALL each contain at least one executable activity module.

#### Scenario: Required activity coverage is checked
- **WHEN** a courseware draft is validated
- **THEN** each of the three required stages SHALL contain at least one allowlisted canonical response activity
- **AND** a prose-only activity suggestion SHALL NOT satisfy the requirement.

#### Scenario: Objective activity is generated
- **WHEN** an activity has a deterministic correct response
- **THEN** it SHALL include a prompt, options or response structure, correct answer, explanation, scoring metadata, and source binding or source-gap state
- **AND** correct answer and explanation SHALL be teacher-only until the existing classroom reveal policy permits feedback.

#### Scenario: Open activity is generated
- **WHEN** an activity requires teacher judgment rather than an objective answer
- **THEN** it SHALL include the task, expected learner output, teacher review points, response kind, and source binding or source-gap state
- **AND** teacher review points SHALL never enter the student payload.

### Requirement: Teacher and student previews enforce role separation
The workspace SHALL provide a teacher preview and an actual student-runtime preview from the same courseware draft or revision.

#### Scenario: Teacher opens teacher preview
- **WHEN** an authorized teacher previews courseware
- **THEN** the view SHALL include answers, explanations, review points, citations, AI provenance, AI review findings, versions, limitations, and validation issues where applicable.

#### Scenario: Teacher opens student preview
- **WHEN** an authorized teacher switches to student preview
- **THEN** the view SHALL hide answers, teacher review points, citation audit internals, provider metadata, and model diagnostics
- **AND** it SHALL render the same step order, student prompts, and allowed interaction states used by the shared runtime.

### Requirement: Module citations and source gaps remain auditable
Every generated module SHALL retain verified source bindings or an explicit source gap through editing using the shared canonical source-state contract `verified`, `ai_generated_source_pending`, or `teacher_created_source_pending`.

#### Scenario: Module uses verified evidence
- **WHEN** a module is grounded in accepted `lesson-design` Source Pack evidence
- **THEN** it SHALL use source state `verified` and retain citation target ids, source-version ids, stable anchors, content hashes, and inclusion rationale
- **AND** citations SHALL render through platform-owned citation metadata rather than model-authored links.

#### Scenario: Module has no verified source
- **WHEN** no eligible source supports a generated module
- **THEN** the module SHALL use `ai_generated_source_pending` or `teacher_created_source_pending` according to lineage and display a user-facing pending-source label separately from that machine value
- **AND** the editor SHALL persist a stable gap id bound to the module id, module content hash, canonical source state, source-binding-set hash, and stable courseware-authoring lineage root for later individual acknowledgement during publication
- **AND** the editor SHALL NOT create, infer, or approve a source-gap acknowledgement.

#### Scenario: Unrelated courseware content changes
- **WHEN** the same module content, source state, and source-binding set remain unchanged while a sibling module, step order, or unrelated draft field changes
- **THEN** that module's source-gap id SHALL remain stable
- **AND** the current draft revision MAY be retained as audit context without becoming part of the gap's validity identity.

#### Scenario: Gap-defining module state changes
- **WHEN** module content is edited or regenerated, a source is added or removed, the canonical source state changes, or a deleted module is recreated
- **THEN** the editor SHALL create a new gap identity when the resulting module still has a pending source state
- **AND** the prior gap identity SHALL remain historical and SHALL NOT authorize later publication.

#### Scenario: Whole-course approval is performed
- **WHEN** a teacher approves a courseware draft that contains unresolved source gaps
- **THEN** the system SHALL keep those gaps unresolved
- **AND** whole-course approval SHALL NOT create or infer individual gap acknowledgements.

### Requirement: AI provenance survives teacher editing
Every module SHALL expose one of AI-generated, AI-generated then teacher-edited, or teacher-created provenance states, and teacher edits SHALL not erase AI lineage.

#### Scenario: Teacher edits an AI-generated module
- **WHEN** the teacher changes accepted AI-generated content
- **THEN** the module SHALL move to AI-generated then teacher-edited provenance
- **AND** its original generation attempt and accepted diff SHALL remain auditable.

#### Scenario: Teacher creates a module
- **WHEN** the teacher adds a module without model generation
- **THEN** it SHALL be marked teacher-created
- **AND** it SHALL still satisfy the shared schema, layout, source, and role contracts.

#### Scenario: Student projection is previewed
- **WHEN** a teacher opens the student projection of generated courseware
- **THEN** the course SHALL show a course-level AI-assisted and teacher-reviewed notice
- **AND** provider names, prompts, schemas, and internal audit metadata SHALL remain hidden.

### Requirement: Teachers can edit and regenerate locally
The courseware editor SHALL support adding, editing, deleting, reordering, resizing, slot reassignment, and local regeneration within the registered runtime contract.

#### Scenario: Teacher regenerates one module
- **WHEN** the teacher requests regeneration for a selected module
- **THEN** the generation context SHALL include that module's stage, step, approved plan baseline, goals, and governed sources
- **AND** the result SHALL modify only the selected module after the teacher accepts its diff.

#### Scenario: Regenerated output affects siblings
- **WHEN** a provider response attempts to change sibling modules, step order, stage timing, or confirmed goals during module regeneration
- **THEN** the system SHALL reject the out-of-scope changes
- **AND** the existing draft content SHALL remain unchanged.

#### Scenario: Teacher changes the module composition
- **WHEN** a teacher changes the module list, order, registered size, layout, or slot assignment
- **THEN** the draft content hash SHALL change
- **AND** the editor SHALL immediately rerun applicable shared static validation.

### Requirement: Courseware generation jobs share durable job semantics
Courseware and local module generation SHALL use the same one-active-job-per-draft, background continuation, cancellation, retry, and idempotency semantics as lesson-plan generation.

#### Scenario: Courseware generation partially fails
- **WHEN** one step or module fails after earlier output completed
- **THEN** completed output SHALL remain available
- **AND** resume SHALL begin at the first incomplete unit without replacing completed units.

#### Scenario: Test provider is selected in production
- **WHEN** a production generation job attempts to use the deterministic test provider
- **THEN** provider selection SHALL fail closed
- **AND** no fixed fixture output SHALL be accepted as a live model result.

### Requirement: Generated courseware drafts remain teacher-private
Courseware drafts, generation jobs, provider audits, validation details, and unpublished revisions SHALL remain visible only to the owner and authorized governance administrators.

#### Scenario: Another teacher searches generated content
- **WHEN** another teacher searches the catalog or smart-preparation workspace
- **THEN** private generated records owned by a different teacher SHALL NOT be returned
- **AND** P0 SHALL provide no sharing, coauthoring, public-template, or marketplace action.

#### Scenario: Student requests a draft
- **WHEN** a student requests a courseware draft or teacher preview route
- **THEN** the system SHALL deny access
- **AND** draft data SHALL NOT be exposed through the student projection endpoint.

