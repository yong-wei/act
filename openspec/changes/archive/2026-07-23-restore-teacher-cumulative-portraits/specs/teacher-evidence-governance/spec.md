## ADDED Requirements

### Requirement: Teacher student detail preserves cumulative attainment
An authorized teacher student detail SHALL use the learner's latest valid
native portrait v2 as its primary capability result. It SHALL keep recent
class-scoped facts limited to diagnostic evidence, activity, and risk
semantics; lack of recent scoped facts SHALL NOT suppress a valid cumulative
portrait.

#### Scenario: Completed-course learner opens in teacher detail
- **WHEN** an authorized teacher opens a learner with a valid native portrait
  v2 and no recent evidence scoped to the current class
- **THEN** the response includes that cumulative portrait and its generated
  timestamp as the primary capability result
- **AND** the recent diagnostic evidence state remains explicitly empty.

#### Scenario: Learner has no valid native portrait
- **WHEN** an authorized teacher opens a learner without a valid native
  portrait v2
- **THEN** the response SHALL remain an explicit no-evidence result
- **AND** it SHALL NOT fabricate a zero-valued or compatibility-derived
  cumulative portrait.

#### Scenario: Revoked evidence suppresses an older portrait
- **WHEN** the latest learner snapshot records
  `no-evidence-after-revocation` and an older native portrait v2 remains in
  storage
- **THEN** the response SHALL remain an explicit no-evidence result
- **AND** it SHALL NOT expose the revoked portrait as current cumulative
  attainment.

### Requirement: Teacher class comparisons preserve missing cumulative values
Teacher student details SHALL calculate a class comparison only when the
learner dimension has evidence and the cumulative class aggregate supplies a
finite mean for that dimension. Missing values SHALL NOT be represented as
zero scores, zero class means, or leading/lagging conclusions.

#### Scenario: A cumulative class mean is missing
- **WHEN** a learner has a cumulative portrait dimension but the cumulative
  class snapshot has no mean for that dimension
- **THEN** the student score, class mean, and gap for that comparison SHALL be
  unavailable
- **AND** the teacher view SHALL NOT report the learner as ahead or behind.

### Requirement: Cumulative class insights avoid recent compatibility projection
The cumulative teacher class-insights route SHALL select its native portrait
summaries without constructing recent class-scoped compatibility portraits.

#### Scenario: Cumulative request includes current scoped facts
- **WHEN** an authorized teacher requests cumulative class insights for a
  class that has current scoped LearningFacts
- **THEN** the request SHALL return its cumulative class response
- **AND** recent compatibility timestamp validation SHALL NOT affect that
  response.
