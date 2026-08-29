## ADDED Requirements

### Requirement: Micro-intervention outcomes cannot bypass mastery authority

Micro-intervention outcomes SHALL remain distinct from assessment-backed mastery. Only an independently verified contribution accepted by the owning Assessment, Arena or simulation authority MAY enter the governed mastery reducer; resource browsing, prompt text, hint requests and policy completion alone SHALL be insufficient.

#### Scenario: An intervention is completed without a scored attempt

- **WHEN** a learner completes a micro-intervention but no independently verified contribution exists
- **THEN** the system SHALL retain the intervention outcome if permitted by privacy policy
- **AND** the mastery state SHALL remain unchanged.

#### Scenario: A verified contribution follows an intervention

- **WHEN** an Assessment, Arena or simulation authority validates a contribution linked to an intervention decision
- **THEN** the contribution SHALL enter the normal governed evidence and reducer path
- **AND** the intervention service SHALL not write mastery directly.
