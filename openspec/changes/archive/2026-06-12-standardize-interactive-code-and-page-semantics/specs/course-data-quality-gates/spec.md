## ADDED Requirements

### Requirement: Non-interactive pages omit generic interaction status modules
The course data-quality gate SHALL prevent standard interactive lessons from rendering generic page interaction status modules on pages that have no learner interaction.

#### Scenario: Non-interactive page has a status module
- **WHEN** a runtime manifest step has no response-producing activity and its interaction kind is `none`, `display`, or another non-interactive value
- **AND** the step declares or renders a generic page interaction status module
- **THEN** the gate SHALL fail with the lesson id, step id, and module id or rendered marker.

#### Scenario: Interactive page keeps activity state
- **WHEN** a runtime manifest step contains a response-producing activity, controlled reveal, or teacher-released activity
- **THEN** the gate SHALL allow activity state, answer state, release state, and evidence markers that are tied to the actual activity
- **AND** it SHALL NOT allow a generic status module as a substitute for the activity contract.

#### Scenario: Unit 1-1 non-interactive pages are scanned
- **WHEN** the no-interaction status gate runs for Unit 1-1
- **THEN** pages without interactions SHALL not include visible "本页互动状态" style text or equivalent generic status chrome.
