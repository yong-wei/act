# runtime-teaching-resource-binding Specification

## Purpose
Bind the runtime file set of teaching resources to overlay cores, and switch live teaching-semantic readers to one course Teaching Projection without rewriting sealed consumer-activation identity.

## Requirements

### Requirement: Runtime file set is the product binding denominator
The product binding inventory MUST be the runtime card, infograph, media, exercise, textbook, and task-simulation files actually served to learners. Git-tracked fixtures MAY gate CI, but MUST NOT be treated as the product coverage denominator.

#### Scenario: Runtime cards exist outside git
- **WHEN** the runtime Authority card directory contains files that are not git-tracked
- **THEN** those files SHALL enter the binding inventory
- **AND** a git-only v2 fixture SHALL NOT be used as the product completeness count

#### Scenario: Git fixture gate remains fail-closed
- **WHEN** CI runs without the runtime blob
- **THEN** the git-tracked v2 fixture gate SHALL still fail closed on missing tracked files
- **AND** it SHALL NOT scan untracked local runtime files as if they were the committed set

### Requirement: Bindings use exact identity or one-to-one crosswalk
A formal BOUND record MUST use a unique Canonical ID match or an explicit one-to-one crosswalk row. Chinese labels, unit-number suffixes, fuzzy match, and vector similarity MUST NOT create BOUND.

#### Scenario: Canonical card id matches an overlay core
- **WHEN** a runtime Authority card id equals an overlay core canonical id
- **THEN** the restage SHALL emit an EXPLAINS binding to that core

#### Scenario: Chinese slug has no crosswalk
- **WHEN** an `act:card:<chinese-slug>` row has no exact crosswalk to one Canonical ID
- **THEN** it SHALL NOT become BOUND
- **AND** it SHALL enter the exception ledger with reason `no-exact-identity`

### Requirement: Task simulations are teaching resources
Arena challenge tasks, Control Odyssey levels that are published tasks, and control-workbench tasks in the simulation-task catalog MUST be projected as simulation resources and bound when an exact Canonical endpoint exists. Classroom simulations whose identity encodes a lesson unit MUST bind to overlay cores for that unit. Classroom simulations without a lesson unit MUST enter the exception ledger.

#### Scenario: Arena task has exact related knowledge
- **WHEN** an Arena task `relatedKnowledge.nodeId` is a Canonical ID present in overlay cores, or a one-to-one crosswalk resolves it
- **THEN** the restage SHALL add `act:simulation:arena:<taskId>` and bind PRACTICES to that core

#### Scenario: Classroom simulation has no lesson unit
- **WHEN** a classroom simulation resource id has no `lessonNN` or `N-N` unit token
- **THEN** it SHALL enter the exception ledger with reason `classroom-sim-without-unit`
- **AND** it SHALL NOT be guessed onto a core

### Requirement: Extraction-source textbooks only
This round MUST bind only textbooks that appear as Authority extraction sources after normalizing `source_edition_id` by stripping a `-root-locus` suffix. The admitted books are `dorf-modern-control-systems-14th`, `franklin-feedback-control-7th`, and `hu-shousong-auto-control-8th`. Other runtime textbooks MUST NOT be added.

#### Scenario: Extraction-source locator is projected
- **WHEN** a SourceDocument/SourceAnchor locator names one of the three extraction-source books and lists Canonical IDs
- **THEN** the restage SHALL include the textbook resource and EXPLAINS bindings to those Canonical IDs that exist in overlay cores

#### Scenario: Non-source textbook is present in runtime
- **WHEN** runtime contains `hu-shousong-exercise-analysis-3rd` or another book absent from extraction sources
- **THEN** this round SHALL NOT add that book as a teaching-projection resource

### Requirement: Teaching-semantic consumers switch together
Activating B′ MUST update course `projection/current.json` and the overlay inspector sidecar `courseProjectionId`/`courseProjectionHash` together. `course-runtime`, `konling`, `learning-path`, and `teaching-resource-rag` MUST resolve that live course projection when the sidecar and `current.json` agree and the Authority release matches. Sealed consumer-activation `activation-0b72f577` MUST stay as the shard/authority identity. Overlay domain-fragments `current.json` and engineering-only consumer combinations MUST stay unchanged.

#### Scenario: All teaching readers match B′
- **WHEN** restage completes successfully
- **THEN** `projection/current.json` and the inspector sidecar SHALL share B′ `projectionId` and `projectionHash`
- **AND** Konling, path planning, course pages, and teaching-resource RAG SHALL resolve B′ for teaching resources

#### Scenario: Partial pointer update is attempted
- **WHEN** sidecar points at B′ but `projection/current.json` still names the predecessor
- **THEN** the restage SHALL fail closed
- **AND** live teaching overlay SHALL NOT apply
