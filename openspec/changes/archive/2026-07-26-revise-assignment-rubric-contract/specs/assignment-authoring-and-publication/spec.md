## MODIFIED Requirements

### Requirement: Every published subjective question has an analytic rubric
The system SHALL require each published subjective assignment question to contain one or more ordered scoring items with stable identifiers, names, maximum points, a natural-language scoring standard, and an optional detailed rubric composed of evaluation levels.
Scoring-item maximums, evaluation-level maximums, AI-suggested scores, teacher-revised scores, and final scores SHALL use one decimal place, and each scoring-item maximum SHALL be at least 1.0 point.

#### Scenario: Teacher defines a rubric
- **WHEN** a teacher edits a subjective question rubric
- **THEN** the editor SHALL allow ordered scoring items, maximum points, scoring standards, optional detailed levels, and feedback guidance to be defined and reordered.

#### Scenario: Teacher defines a scoring item without detailed rubric
- **WHEN** a teacher leaves the optional detailed rubric disabled
- **THEN** the scoring standard SHALL be required for publication
- **AND** automatic grading SHALL score directly against that standard from zero through the scoring-item maximum.

#### Scenario: Teacher creates a new scoring item
- **WHEN** a teacher adds a scoring item
- **THEN** its detailed rubric SHALL default to disabled
- **AND** no evaluation level SHALL be required unless the teacher explicitly enables it.

#### Scenario: Teacher enables detailed rubric
- **WHEN** a teacher enables the optional detailed rubric for a scoring item
- **THEN** the system SHALL maintain ordered evaluation levels containing a name, maximum score, and scoring guideline
- **AND** every level scoring guideline SHALL be required for publication while the general scoring standard MAY be empty.

#### Scenario: Rubric lacks gradable evidence
- **WHEN** a scoring item lacks a stable id, has a maximum below 1.0, lacks its required scoring standard, or contains an enabled level without a scoring guideline
- **THEN** the system SHALL block publication and identify the affected question, scoring item, and field.

#### Scenario: Default level values are created
- **WHEN** the system creates an evaluation-level name or maximum score
- **THEN** that value SHALL be a real publishable value
- **AND** the teacher's first typed or pasted replacement SHALL replace the default rather than append to it.

### Requirement: Publication validates all score scales without silent rescaling
The system MUST block assignment publication unless the assignment total, question totals, scoring-item totals, and enabled evaluation-level ranges are internally consistent on a one-decimal score grid.

#### Scenario: Totals agree
- **WHEN** assignment total equals the sum of question points and every question point value equals the sum of its scoring-item maximums
- **THEN** score consistency SHALL pass the publication gate if every enabled detailed rubric also forms valid ordered ranges.

#### Scenario: Totals disagree
- **WHEN** any assignment, question, scoring-item, or evaluation-level score scale conflicts
- **THEN** publication SHALL fail with a teacher-visible reconciliation result
- **AND** the system SHALL NOT silently normalize, rescale, or select one source as authoritative.

#### Scenario: Totals and level ranges agree
- **WHEN** the assignment total equals the sum of question points, each question point value equals the sum of its scoring-item maximums, and every enabled detailed rubric forms valid ordered ranges from the scoring-item maximum to zero
- **THEN** score consistency SHALL pass the publication gate.

#### Scenario: Totals or ranges disagree
- **WHEN** any assignment, question, scoring-item, or evaluation-level score scale conflicts
- **THEN** publication SHALL fail with a teacher-visible reconciliation result
- **AND** the system SHALL NOT silently normalize, rescale, or select one source as authoritative.

## ADDED Requirements

### Requirement: Evaluation levels use deterministic ranges and score correction
The system SHALL derive each enabled evaluation level's minimum from adjacent descending maximums, assign every shared boundary to the higher level, and constrain suggested scores to the selected level's legal one-decimal range.

#### Scenario: Adjacent levels share a boundary
- **WHEN** a 100-point scoring item has descending level maximums of 100.0, 90.0, and 80.0
- **THEN** the highest level SHALL include 90.0 through 100.0
- **AND** the next level SHALL include 80.0 through 89.9.

#### Scenario: Suggested score exceeds selected level
- **WHEN** automatic grading selects a level but suggests a score above its inclusive or exclusive upper bound or below its lower bound
- **THEN** the platform SHALL clamp the score to the nearest legal one-decimal value in that level
- **AND** the persisted final score SHALL use one decimal place.

#### Scenario: Teacher edits a level maximum
- **WHEN** a teacher changes a non-highest level maximum
- **THEN** the system SHALL reorder complete level records by maximum score descending
- **AND** each level name, scoring guideline, and score SHALL remain attached to the same record.

#### Scenario: Teacher attempts to edit the highest maximum
- **WHEN** a scoring item's maximum changes or a teacher targets the highest level maximum
- **THEN** the highest level maximum SHALL remain synchronized to the scoring-item maximum
- **AND** it SHALL NOT be independently editable.

### Requirement: Detailed rubric supports governed incremental levels
The system SHALL create and extend evaluation levels using deterministic names and maximum-score rules while preserving at least a 0.1-point legal interval.

#### Scenario: Teacher enables detailed rubric for the first time
- **WHEN** the detailed rubric changes from disabled to enabled
- **THEN** the system SHALL create only an `优秀` level whose range covers zero through the scoring-item maximum.

#### Scenario: Teacher adds levels sequentially
- **WHEN** the teacher adds levels after `优秀`
- **THEN** the next initial names SHALL be `良好`, `中等`, `及格`, and `不及格` in that order
- **AND** their default maximums SHALL be 90%, 80%, 70%, and 60% of the scoring-item maximum respectively, rounded upward to one decimal place
- **AND** the sixth and later level initial name SHALL be `自定义`.

#### Scenario: Custom level uses ratio extension
- **WHEN** the teacher adds a sixth or later custom level and at least two existing level maximums establish a ratio
- **THEN** the new default maximum SHALL extend the ratio between the last two maximums and round upward to one decimal place.

#### Scenario: Rounded extension repeats a maximum
- **WHEN** sixth-or-later ratio extension rounds to the same maximum as the preceding lower level
- **THEN** the new level maximum SHALL be 0.1 point below the preceding level
- **AND** the system SHALL reject the addition when no interval of at least 0.1 point remains.

### Requirement: Detailed rubric shortcuts preserve teacher content
The system SHALL provide five-level and two-level shortcuts and SHALL preserve all existing level records that fit in the target count unless the teacher confirms removal.

#### Scenario: Empty rubric uses five-level shortcut
- **WHEN** a teacher applies the five-level shortcut to an unedited blank detailed rubric
- **THEN** the levels SHALL be named `优秀`, `良好`, `中等`, `及格`, and `不及格`
- **AND** their maximums SHALL be 100%, 90%, 80%, 70%, and 60% of the scoring-item maximum, rounded upward to one decimal place, with the lowest range extending to zero.

#### Scenario: Empty rubric uses two-level shortcut
- **WHEN** a teacher applies the two-level shortcut to an unedited blank detailed rubric
- **THEN** the levels SHALL be `通过` and `不通过`
- **AND** 60% of the scoring-item maximum SHALL be the boundary assigned to `通过`, while `不通过` extends to zero.

#### Scenario: Shortcut removes levels
- **WHEN** the shortcut target has fewer levels than the current rubric
- **THEN** the system SHALL identify the trailing records and content that will be discarded and require teacher confirmation
- **AND** after confirmation it SHALL remove only those trailing records and extend the lowest retained range to zero.

#### Scenario: Shortcut adds levels to edited content
- **WHEN** the shortcut target has more levels than a rubric containing teacher-edited records
- **THEN** the system SHALL preserve existing names, scoring guidelines, and maximums
- **AND** it SHALL extend the missing levels using the last-two-maximum ratio, using standard names and percentages only where no teacher-edited content exists.
