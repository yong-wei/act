# learner-graph-overlays Specification

## Purpose
Define server-owned learner and class graph overlays for Graph Center, including authorization, privacy-preserving aggregation, and separation from canonical graph catalog data.
## Requirements
### Requirement: Learner graph overlays are server-owned and scoped
The system SHALL provide learner graph overlays from server-owned learner state and governed evidence, scoped to the authorized learner.

#### Scenario: Learner overlay is requested
- **WHEN** an authorized learner graph overlay is requested
- **THEN** each overlay item SHALL reference graph domain and graph node id
- **AND** it SHALL expose learner state, score or null, confidence, evidence count, last evidence time, privacy-safe evidence refs, recommendation, reason code, evidence window, source coverage, verified citation refs, and limitations.

#### Scenario: Learner overlay recommends next action
- **WHEN** a learner graph overlay includes a recommendation
- **THEN** the recommendation SHALL distinguish target requirement, observed mastery, resource coverage, and path context
- **AND** it SHALL include source coverage, evidence window, confidence, reason code, and required citation or limitation metadata.

#### Scenario: Unauthorized learner overlay is requested
- **WHEN** a user requests another learner's overlay without authorization
- **THEN** the system SHALL reject the request
- **AND** it SHALL not expose raw evidence, private memory, or inferred state.

### Requirement: Class graph overlays aggregate governed learner state
The system SHALL provide class heat overlays only for authorized teacher or administrator contexts.

#### Scenario: Teacher requests class overlay
- **WHEN** an authorized teacher requests a class graph overlay
- **THEN** each overlay item SHALL expose mastered, developing, weak, not-started, and evidence-needed distributions
- **AND** it SHALL include average score, confidence, common issue codes, denominator, included population, excluded population, suppression reason, and rounding policy without raw private evidence.

#### Scenario: Class overlay has a low denominator
- **WHEN** a graph-node distribution has too few students, too few included records, or a filter state that would reveal an individual's state
- **THEN** the class overlay SHALL suppress, bucket, or mark the distribution unavailable
- **AND** it SHALL expose the suppression reason and denominator metadata instead of a reversible distribution.

### Requirement: Overlay states do not mutate graph body data
Learner and class overlays SHALL remain separate payloads from objective and graph catalogs.

#### Scenario: Overlay is generated
- **WHEN** learner or class graph state is computed
- **THEN** graph body node definitions SHALL remain unchanged
- **AND** low-confidence or missing evidence SHALL be represented as limitations rather than fabricated mastery.

### Requirement: Graph Center exposes overlay modes with explicit status labels
The Graph Center UI SHALL expose resource coverage, learner, and class overlay modes without relying on color alone.

#### Scenario: User switches overlay mode
- **WHEN** a user selects resource coverage, learner, or class mode
- **THEN** graph node cards and selected-node detail SHALL show the active overlay status using text labels and mode-specific summaries
- **AND** unavailable, empty, low-confidence, suppressed, and unauthorized overlay states SHALL remain visible as explicit status text or limitations.

#### Scenario: Filtered overlays change status
- **WHEN** objective, portrait, or node filters change the visible graph subset
- **THEN** learner and class overlay statuses and limitations SHALL be recalculated for the filtered nodes
- **AND** stale overlay limitations from the unfiltered payload SHALL NOT be shown for a currently available filtered subset.
