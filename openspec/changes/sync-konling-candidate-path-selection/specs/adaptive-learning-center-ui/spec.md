## MODIFIED Requirements

### Requirement: Generated path options are selectable and comparable
The adaptive learning center SHALL display generated path options as comparable, actionable route choices where each option is a complete decision module and not a detached action target, and SHALL synchronize a successful Konling selection from the same persisted candidate batch.

#### Scenario: Options are shown after generation
- **WHEN** generation succeeds
- **THEN** the UI SHALL show three comparable path options when distinct active, preparation, or locked-route structures are available
- **AND** each option SHALL show estimated duration, resource mix, current recommendation reason, readiness state, checkpoints, unlockable heavy nodes, expected result, and risk note
- **AND** each option SHALL keep its primary selection action, adjustment action, rejection action, and explanation action inside the same visual and DOM module as the option content.

#### Scenario: Student chooses an option
- **WHEN** the student selects, asks Konling to adjust, rejects, or asks why an option was recommended
- **THEN** the action SHALL be recorded through governed path activity
- **AND** the UI SHALL preserve other options as alternatives until a later recalculation or explicit dismissal.

#### Scenario: Konling selection refreshes the path center
- **WHEN** Konling reports a successful selection with a verified `batchId` and `candidateId`
- **THEN** the path center SHALL reload that authorized batch and display the matching candidate as selected
- **AND** it SHALL NOT infer the selected candidate from assistant prose or automatically start path execution.

#### Scenario: Desktop comparison is rendered
- **WHEN** the path-selection workspace renders on desktop
- **THEN** the options SHALL remain directly comparable through aligned fields, shared labels, and stable resource icons
- **AND** the UI SHALL NOT require the student to match a path column in one region with a separate action card or detached action strip in another region
- **AND** keyboard focus order SHALL move through each option's content and actions before moving to the next option.
