# graph-path-experience Specification

## Purpose
TBD - created by archiving change redesign-graph-path-experience. Update Purpose after archive.
## Requirements
### Requirement: Knowledge graph uses the available viewport coherently
The graph SHALL fit the full bounded node set into its actual viewport in both 2D and 3D. Layout coordinates, camera framing and label projections SHALL share one coordinate contract.

#### Scenario: Viewer opens or resizes a graph
- **WHEN** a root or domain graph becomes ready or its viewport changes
- **THEN** fitting SHALL center the bounded visible graph without clipping caused by a duplicated coordinate offset
- **AND** readable labels SHALL remain attached to their corresponding nodes

### Requirement: Visual hierarchy communicates knowledge and relationships
The graph SHALL make domain names, important knowledge objects, selected neighbors, relation direction and available resources discernible in both dimensions and supported themes. Decoration SHALL remain subordinate to this information.

#### Scenario: Viewer explores a domain
- **WHEN** the viewer switches dimensions, selects an object, or changes relation filters
- **THEN** the view SHALL preserve semantic identity and relation direction
- **AND** selected and hovered objects SHALL retain readable names while bounded label collision handling prioritizes important visible objects

### Requirement: Learning paths consume bound resources in prerequisite order
The production learning-path pipeline SHALL match resources through explicit graph bindings and SHALL respect applicable published prerequisite dependencies. Every selected resource SHALL retain a resolvable launch target and its actual resource type.

#### Scenario: Goal has bound resources and prerequisites
- **WHEN** a learning path is generated for the goal
- **THEN** eligible bound resources SHALL be considered across supported resource families
- **AND** unresolved prerequisite knowledge SHALL precede its dependent knowledge or produce an explicit planning limitation
- **AND** each selected resource SHALL be openable through the existing resource launch contract

### Requirement: Published resources have stable references independent of recommendation eligibility
Every supported published resource family SHALL have a controlled reference entry bound to resourceId and immutable Teaching Projection and Authority snapshot identity. The server SHALL resolve content and destinations from verified publication data, without trusting client-provided source paths, resource types or href values.

#### Scenario: Viewer opens a published resource
- **WHEN** a valid published resource reference is opened
- **THEN** the entry SHALL display its learner-visible content or navigate to its verified backend
- **AND** a launch from a learning path SHALL preserve the return-to-path context

#### Scenario: Resource is a container or lacks readable content
- **WHEN** the resource is a textbook container, reference-only entry, or has unavailable content
- **THEN** the reference SHALL display accurate metadata and its limitation
- **AND** it SHALL NOT count as an executable learning unit or generate completion evidence merely by opening

#### Scenario: A reference has a stale or forged identity
- **WHEN** projection hashes, Authority snapshot identity, resource membership or access policy cannot be verified
- **THEN** the entry SHALL fail closed rather than resolve another current resource silently

### Requirement: Published contract is an explicit recommendation qualification source
Machine-verified publication facts SHALL use an explicit published-contract qualification distinct from human-confirmed review. A published resource SHALL be recommendable only when it has real canonical bindings, student access and executable content or a verified launch backend. Ordinary reading resources SHALL NOT require invented competency or mastery evidence.

#### Scenario: Optional resource is not bound to knowledge
- **WHEN** a published optional resource has no canonical binding
- **THEN** it MAY remain referenceable
- **AND** it SHALL NOT enter knowledge-goal recommendation candidates through guessed coverage

#### Scenario: A bound published resource is executable
- **WHEN** the verified publication and runtime provide a real binding and executable learner-visible content
- **THEN** it SHALL be considered through published-contract qualification without forging a human review record
- **AND** manual overrides and teacher decisions SHALL retain their own existing qualification requirements

### Requirement: Resource planning consumes a versioned summary and feature index
Resource planning SHALL consume version-bound summaries and features rather than rereading resource bodies on every generation. Features SHALL include supported type, actual knowledge bindings and available difficulty, duration and usage evidence with explicit unknown or estimated states. Index updates and actual resource opening MAY read full content for extraction or verification.

#### Scenario: The same publication is planned repeatedly
- **WHEN** a learner requests another path against the same valid publication
- **THEN** planning SHALL reuse its summary/feature index
- **AND** SHALL NOT read resource body bytes merely to rank candidates or claim a fresh body verification that did not happen

#### Scenario: A publication changes
- **WHEN** resource or binding publication identity changes
- **THEN** stale index entries SHALL be invalidated or replaced before use
- **AND** recommendation SHALL preserve the new publication identity

### Requirement: Three path orientations rank resource features against learner needs
The existing three path orientations SHALL retain distinct ranking priorities while matching learner profile, goal, budget and resource features. Actual selection and completion history MAY inform personal or collaborative ranking; absent or insufficient history SHALL use an explicit content-based fallback.

#### Scenario: A learner compares the three orientations
- **WHEN** the same learner and goal request candidate paths
- **THEN** ranking SHALL apply the orientation-specific priorities to the same qualified feature inputs
- **AND** prerequisite, access, executability and budget constraints SHALL remain binding regardless of ranking score

#### Scenario: Usage evidence is sparse
- **WHEN** resource history has insufficient independent learners or no usable interactions
- **THEN** ranking SHALL fall back to content features and rules without invented popularity or collaborative confidence
- **AND** another learner's identifiers and raw interactions SHALL NOT appear in the recommendation output

### Requirement: Observed resource attributes adapt from qualified interactions
Resource features SHALL preserve baseline attributes and separately derive observed difficulty or effort from qualified, resource-version-linked interactions. Derived attributes SHALL carry sample size, confidence, calculation version and evidence watermark, remain reproducible, and affect personalized ranking when supported by sufficient evidence.

#### Scenario: Valid resource interactions accumulate
- **WHEN** resource-linked answer outcomes, completion, effort, retries or explicit feedback provide sufficient evidence
- **THEN** observed attributes SHALL update with traceable evidence and confidence
- **AND** ranking SHALL use the updated estimate in relation to the current learner profile

#### Scenario: Evidence is duplicated, sparse or belongs to another resource version
- **WHEN** events are replayed, sample support is insufficient, or content identity differs
- **THEN** aggregation SHALL avoid duplicate contributions and cross-version contamination
- **AND** insufficient support SHALL retain the baseline or an explicitly low-confidence estimate

#### Scenario: A learner only opens or selects a resource
- **WHEN** the available event is a click, opening, or path-option selection
- **THEN** it MAY update usage or preference features
- **AND** it SHALL NOT be interpreted as answer correctness, mastery, or resource difficulty evidence by itself
