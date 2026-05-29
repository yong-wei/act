## Purpose

Define Stage 2 adaptive experiment operations UI contracts for experiment reporting, local bandit comparison, long-term memory audit, and teacher bulk ResourceNode operations.
## Requirements
### Requirement: Stage 2 adaptive operations are gated
The system SHALL keep adaptive experiment and optimization UI behind Stage 2 feature flags and prerequisite checks.

#### Scenario: Stage 1 is not stable
- **WHEN** required Stage 1 path, Konling, teacher management, privacy, and evaluation contracts are not available
- **THEN** Stage 2 operation UI SHALL be hidden, disabled, or shown as unavailable with prerequisite reasons.

### Requirement: Experiment reports are privacy-safe
The system SHALL present adaptive experiment reports through aggregate, confidence-aware, and privacy-safe summaries.

#### Scenario: Teacher or admin reviews experiment outcome
- **WHEN** an experiment report is displayed
- **THEN** the UI SHALL show variant, sample count, confidence or completeness marker, evidence window, aggregation level, and privacy scope.

### Requirement: Bandit UI cannot bypass feasibility constraints
The system SHALL present contextual bandit as local reranking after deterministic feasible candidates exist.

#### Scenario: Bandit comparison is displayed
- **WHEN** a bandit comparison appears in operations UI
- **THEN** the UI SHALL state or encode that prerequisites, privacy, availability, teacher policy, device, and time constraints were enforced before reranking.

### Requirement: Long-term memory audit protects raw content
The system SHALL provide long-term learner memory and strategy memory audit UI without exposing raw private memory by default.

#### Scenario: Memory audit entry is inspected
- **WHEN** a teacher or admin inspects a memory-derived operation result
- **THEN** the UI SHALL show privacy-scoped summaries and audit metadata rather than raw dialogue or private memory content unless audit-only authorization permits it.

### Requirement: Teacher bulk operations are permission gated
The system SHALL define teacher bulk ResourceNode operation surfaces with explicit role permissions, coverage summaries, policy review, and system-owned issue triage boundaries.

#### Scenario: Teacher reviews bulk operation controls
- **WHEN** Stage 2 bulk ResourceNode operations are displayed
- **THEN** the UI SHALL show bulk mapping availability, policy review counts, ResourceNode coverage, and system-owned issue triage as separate panels.
- **AND** system-owned issue triage SHALL be disabled or restricted for non-admin/non-audit roles.
