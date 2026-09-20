## ADDED Requirements

### Requirement: Fleet completion includes executed dynamic acceptance
Fleet completion SHALL include actual active-route and embedded-consumer runs with dynamic visual evidence and measured hardware context; source-reference tests alone SHALL NOT establish completion.

#### Scenario: The fleet series is reported complete
- **WHEN** the completion report is assembled
- **THEN** it identifies executed vessel scenarios, actual performance results and unresolved acceptance items separately
- **AND** missing hardware or missing runtime evidence is not relabeled as passed
