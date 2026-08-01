## Purpose
Provide Arena-derived growth signals and next challenge recommendations in the student profile without inventing evidence outside official submissions.
## Requirements
### Requirement: Student profile summarizes Arena growth by capability
The system SHALL aggregate official Arena submission history into authoritative capability-level growth signals and MAY expose separately labeled, low-confidence training observations derived from governed virtual simulation runs.

#### Scenario: Student has Arena submissions
- **WHEN** the profile API builds Arena portfolio data
- **THEN** it includes capability coverage, weak areas, and improvement signals derived from official submissions
- **AND** it keeps any virtual-training observation separate from official capability status

#### Scenario: Student has training observations only
- **WHEN** the student has governed virtual training runs but no official Arena submissions
- **THEN** the profile MUST expose the training observations with task attribution and low-confidence provenance
- **AND** it MUST NOT report official capability coverage, formal completion, or leaderboard achievement from those observations

### Requirement: Student profile recommends next Arena challenges
The system SHALL recommend Arena challenges from training metadata and the student's history.

#### Scenario: Student has weak metrics or missing prerequisites
- **WHEN** recommendations are generated
- **THEN** each recommended challenge includes a reason tied to capability gaps, weak metrics, or next training stage

### Requirement: Arena recommendations avoid fabricated evidence
The system SHALL not infer Arena capability from unavailable or unofficial submission evidence. Governed training observations MAY refine practice recommendations only when their preview boundary and confidence are explicit.

#### Scenario: Student has no official submissions
- **WHEN** the profile API builds Arena growth data
- **THEN** it returns beginner-safe recommendations and states that official evidence is not yet available
- **AND** any training-based recommendation rationale SHALL identify the evidence as preview training rather than official attainment
