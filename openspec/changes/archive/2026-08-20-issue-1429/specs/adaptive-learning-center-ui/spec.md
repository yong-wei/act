## ADDED Requirements

### Requirement: Candidate batches expose explicit multi-option comparison
The adaptive learning center SHALL present a candidate-batch-level comparison workspace that shows server-owned facts for every available candidate and requires the student to explicitly choose two different candidates before rendering pairwise difference details.

#### Scenario: Two candidates are available
- **WHEN** a valid candidate batch contains two candidates
- **THEN** the center SHALL show both candidates in one comparison workspace
- **AND** it SHALL expose exactly one selectable comparison pair
- **AND** it SHALL not silently choose a comparison pair before the student confirms it.

#### Scenario: Three candidates are available
- **WHEN** a valid candidate batch contains three candidates
- **THEN** the center SHALL allow `A-B`, `A-C`, and `B-C`
- **AND** it SHALL reject selecting the same candidate twice
- **AND** it SHALL identify both selected candidates in the result region.

#### Scenario: Candidate batch has zero or one candidate
- **WHEN** a candidate batch contains zero or one candidate
- **THEN** the center SHALL show the available facts or an unavailable state
- **AND** it SHALL not render a pair selector or fabricate a comparison result.

### Requirement: Candidate comparison summaries remain factual and read-only
The adaptive learning center SHALL show a fixed-dimension, candidate-row summary using server-owned facts and SHALL not rank, score, reorder, adopt, or mutate paths from comparison interactions.

#### Scenario: Summary renders complete facts
- **WHEN** candidate snapshots provide facts for duration, resource mix, checkpoints, readiness, or terminal validation
- **THEN** the center SHALL render those values against stable candidate labels
- **AND** it SHALL identify equal dimensions as no difference without deriving a recommendation.

#### Scenario: Summary has missing facts
- **WHEN** a candidate snapshot lacks a required fact
- **THEN** the center SHALL display a data-insufficient state for that fact
- **AND** it SHALL not substitute a default or inferred value.

#### Scenario: Student interacts with comparison
- **WHEN** the student selects a pair or opens its difference details
- **THEN** the center SHALL update only read-only viewing state and URL parameters
- **AND** existing path selection and execution state SHALL remain unchanged.

### Requirement: Candidate comparison state is version-safe and accessible
The adaptive learning center SHALL identify comparison state with the candidate batch, path version, and normalized unordered pair, reject stale responses, and remain operable at 320px with keyboard navigation.

#### Scenario: Comparison pair is confirmed
- **WHEN** the student confirms two different candidates
- **THEN** the URL MAY persist the complete batch, version, and pair identity
- **AND** the center SHALL restore pair details only when all identities still match the loaded batch.

#### Scenario: Candidate batch or pair changes during a request
- **WHEN** a candidate batch, path version, candidate set, or selected pair changes before a difference response returns
- **THEN** the center SHALL discard the response
- **AND** it SHALL not display the stale result for the current candidates.

#### Scenario: Narrow viewport and keyboard use
- **WHEN** the workspace is rendered at 320px or operated without a pointer
- **THEN** every candidate pair, selector, status, and result action SHALL remain readable, focusable, and named
- **AND** the page SHALL not require horizontal scrolling to access comparison facts.
