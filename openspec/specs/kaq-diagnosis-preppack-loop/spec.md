## Purpose

Define the governed loop that turns K/A/Q graph-aware class diagnosis into reviewable teacher prep-pack candidates, preserves resource coverage and evidence provenance, and links activated prep items back to later learning evidence.
## Requirements
### Requirement: Class diagnosis can target K/A/Q graph nodes
The system SHALL connect class diagnosis to K/A/Q graph nodes, LearningGoals, overlay distributions, resource coverage gaps, and governed evidence.

#### Scenario: Teacher opens graph-aware class diagnosis
- **WHEN** an authorized teacher requests diagnosis for a LearningGoal, graph node, or class graph overlay scope
- **THEN** the diagnosis SHALL expose weak graph nodes, affected population, denominator or suppression metadata, evidence refs, citation refs, resource coverage gaps, confidence, version refs, and limitations
- **AND** raw private evidence and hidden evaluation internals SHALL remain redacted.

#### Scenario: Diagnosis lacks enough evidence
- **WHEN** evidence coverage, citation support, overlay confidence, or class denominator is insufficient
- **THEN** the diagnosis SHALL expose the limitation
- **AND** it SHALL prefer evidence-gathering or draft-resource requests over high-confidence intervention claims.

### Requirement: Prep-pack candidates target graph nodes and resource gaps
The system SHALL generate reviewable prep-pack candidates from graph-aware diagnosis and resource coverage gaps.

#### Scenario: Prep-pack candidate is generated
- **WHEN** class diagnosis identifies a weak graph node or LearningGoal subgraph with actionable evidence or resource gaps
- **THEN** the prep-pack candidate SHALL include target LearningGoal or graph node ids, affected population summary, source diagnosis refs, evidence refs, citation refs, resource or gap refs, expected impact, confidence, insertion target, review state, and limitations.

#### Scenario: Candidate lacks governed support
- **WHEN** a prep-pack candidate cannot be tied to governed diagnosis, ResourceNode metadata, ResourceCoverage, evidence refs, citation refs, or lesson insertion context
- **THEN** it SHALL be marked as draft-request or excluded from automatic insertion eligibility.

### Requirement: The loop is auditable after activation
Activated K/A/Q prep-pack items SHALL remain linked to subsequent learning evidence and overlay refresh.

#### Scenario: Learners interact with activated prep item
- **WHEN** a student interacts with an activated graph-aware prep-pack item
- **THEN** generated evidence SHALL reference the pack item, target graph node where safe, source diagnosis, and privacy-safe evidence refs
- **AND** teacher reports SHALL be able to compare post-activation evidence with the diagnosis that motivated the pack.

