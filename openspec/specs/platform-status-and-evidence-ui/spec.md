## Purpose

Define shared display semantics for platform evidence, confidence, privacy, replay, protocol, evaluation, readiness, missing-context, and fallback states without moving domain truth into shared UI primitives.
## Requirements
### Requirement: Evidence status UI uses shared semantics
The system SHALL provide shared UI semantics for evidence confidence, source coverage, privacy scope, replay status, protocol version, official/preview evaluation boundary, readiness, missing context, and fallback state.

#### Scenario: Evidence-backed claim is displayed
- **WHEN** a page displays a simulation, Arena, ResourceNode, learner-state, path, Konling, teacher-management, or experiment claim
- **THEN** it SHALL display confidence and source context through shared status semantics rather than ad hoc labels.

### Requirement: Status details respect role scope
The system SHALL render status details according to student-visible, teacher-scoped, admin-scoped, audit-only, and system-internal visibility.

#### Scenario: Restricted source is present
- **WHEN** a status references hidden official evaluation internals, raw high-frequency traces, raw answers, or private Konling memory
- **THEN** the UI SHALL show an allowed summary or restricted marker without exposing the restricted payload.

### Requirement: Status primitives preserve domain ownership
The system SHALL keep shared status UI primitives display-only and SHALL NOT derive domain truth, privacy authorization, replay verification, learner state, ResourceNode readiness, or official evaluation status inside shared components.

#### Scenario: Feature passes a status payload
- **WHEN** simulation, Arena, ResourceNode, learner-state, path, Konling, teacher-management, or experiment code passes a governed status payload to shared UI
- **THEN** the shared component SHALL map the payload to labels, tones, summaries, details, and restricted markers
- **AND** the feature domain SHALL remain responsible for computing source coverage, confidence, authorization, readiness, replay, and official/preview semantics.

### Requirement: Low-confidence states are explicit
The system SHALL distinguish complete, partial, stale, missing, unsupported, and low-confidence states.

#### Scenario: Personalization is limited
- **WHEN** evidence or mapping coverage is insufficient for a confident recommendation, path, or intervention
- **THEN** the UI SHALL show the limiting coverage or fallback reason.

### Requirement: Workspace evidence rail uses shared status semantics
Dense workspaces SHALL place confidence, official/preview state, source coverage, replay/readiness, and missing-context states in a consistent evidence rail or equivalent compact status zone.

#### Scenario: Workspace shows governed state
- **WHEN** Control Workbench, Arena detail, interactive course runtime, simulation workspace, teacher analytics, or admin governance shows governed state
- **THEN** the state SHALL use shared evidence/status semantics
- **AND** workspace-specific panels SHALL NOT invent page-local status badge vocabularies for the same concepts.

### Requirement: Loading, empty, degraded, and unavailable states inherit route archetype
Platform status UI SHALL render loading, empty, degraded, feature-flagged, low-confidence, and missing-evidence states within the current route archetype and theme template.

#### Scenario: Status state appears during redesign
- **WHEN** a learner, entry, workspace, knowledge, teacher, admin, or report surface enters loading, empty, degraded, unavailable, or low-confidence state
- **THEN** the state SHALL use the route's approved visual template, status vocabulary, and next-action guidance
- **AND** it SHALL NOT fall back to disconnected spinner pages, placeholder cards, or old dark loading screens.
