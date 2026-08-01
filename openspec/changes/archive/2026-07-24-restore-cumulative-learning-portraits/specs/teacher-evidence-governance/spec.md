## MODIFIED Requirements

### Requirement: Teacher student insight includes traceable evidence drawer data
Teacher student insight APIs SHALL expose cumulative governed evidence summaries,
growth events, and source provenance for a learner who is currently enrolled in
one of the teacher's classes. Evidence eligibility SHALL follow the learner's
complete authorized history rather than a calendar window or source-class
filter. The APIs SHALL NOT expose a recent portrait scope.

#### Scenario: Current class member evidence is summarized
- **WHEN** a teacher opens a student currently enrolled in one of their classes
- **THEN** the response SHALL include the learner's cumulative portrait evidence summary and newest-first paginated activity
- **AND** absence of newer activity SHALL NOT suppress an existing cumulative portrait, trend, risk, or growth history.

#### Scenario: Historical evidence originated outside the current class
- **WHEN** an authorized current member has eligible facts produced before joining the class or in another learning context
- **THEN** those facts SHALL contribute to the learner's cumulative portrait and teacher-visible governed summaries
- **AND** existing redaction SHALL continue to hide raw answers, private AI dialogue, hidden evaluation content, and high-frequency traces.

#### Scenario: Simulation drilldown is scoped
- **WHEN** a teacher opens simulation or Arena evidence drilldown for a student they teach
- **THEN** the response SHALL include authorized trace references, summary metrics, source provenance, replay confidence, and low-confidence reasons without leaking hidden official evaluation internals or raw high-frequency trace payloads.

### Requirement: Teacher summaries do not cross class scope
Teacher insight services SHALL use current class membership as the authorization
and aggregation boundary. They SHALL exclude learners who are not current
members, while allowing a current member's complete eligible cumulative state
to contribute regardless of where its source facts were produced. This change
SHALL NOT broaden access to raw LearningFacts or alter existing field redaction.

#### Scenario: Evidence exists for current members and unrelated learners
- **WHEN** a teacher opens a class summary containing current members with historical evidence and other non-member learners have evidence for the same activities
- **THEN** the summary SHALL include each current member's complete cumulative state
- **AND** it SHALL exclude every non-member learner and revoke access when a member leaves the teacher's classes.

## ADDED Requirements

### Requirement: Teacher class insights aggregate current learner portraits
Teacher class insight APIs SHALL derive the class portrait from the canonical
cumulative portraits of current class members and SHALL read only immutable
`class-competency.cumulative.v2` materializations after migration. The API and
UI SHALL NOT offer a recent scope.

#### Scenario: Class dimension has partial member coverage
- **WHEN** some current members have valid evidence for a portrait dimension and others do not
- **THEN** the class mean SHALL give equal weight to each member with valid evidence for that dimension
- **AND** the response SHALL report included count, missing count, and mean confidence without substituting zero for missing members.

#### Scenario: Membership changes
- **WHEN** a learner joins, leaves, or transfers into a class
- **THEN** the class aggregate SHALL add or remove that learner's latest cumulative projection
- **AND** the learner's portrait and historical facts SHALL NOT be rebuilt, copied, or deleted.

#### Scenario: Class trend and risk are requested
- **WHEN** an authorized teacher opens class trend or risk summaries
- **THEN** the response SHALL aggregate current members' last personal trend and last evidence-backed risk states
- **AND** it SHALL NOT infer trend from changes in the class mean or clear risk because no newer fact exists.

#### Scenario: Removed recent scope is requested
- **WHEN** a client explicitly requests `scope=recent` or another removed calendar-window portrait scope
- **THEN** the API SHALL return an explicit unsupported-scope error
- **AND** it SHALL NOT ignore the parameter, fall back to cumulative, or construct a compatibility portrait.

### Requirement: Teacher student insight exposes cumulative growth history
Teacher student insight APIs SHALL expose a privacy-safe summary of meaningful
cumulative growth events for current class members.

#### Scenario: Teacher opens growth history
- **WHEN** an authorized teacher opens a current member's growth history
- **THEN** the response SHALL include meaningful level changes, strength changes, evidence-backed risk changes, and important contributed milestones in newest-first order
- **AND** it SHALL NOT expose a duplicate of every activity or role-restricted raw payload.

#### Scenario: Student leaves the teacher's classes
- **WHEN** the learner is no longer a current member of any class managed by the teacher
- **THEN** teacher access to that learner's portrait, evidence, and growth history SHALL end immediately.

## MODIFIED Requirements

### Requirement: Teacher student detail preserves cumulative attainment
An authorized teacher student detail SHALL use the learner's latest valid
canonical cumulative portrait as its only primary capability result. Activity,
trend, risk, diagnosis, and growth summaries SHALL be derived from the same
cumulative evidence contract and SHALL preserve current-member authorization.

#### Scenario: Learner has no newer evidence
- **WHEN** an authorized teacher opens a current member with a valid cumulative portrait and no newer eligible evidence
- **THEN** the response SHALL include that portrait, last evidence-triggered trend and risk, growth summary, and evidence cutoff
- **AND** it SHALL NOT create an empty calendar-window diagnosis or compatibility portrait.

#### Scenario: Learner has no valid cumulative portrait
- **WHEN** an authorized teacher opens a current member without a valid cumulative portrait
- **THEN** the response SHALL remain an explicit no-eligible-evidence result
- **AND** it SHALL NOT fabricate a zero-valued or compatibility-derived cumulative portrait.

#### Scenario: Revoked evidence suppresses an older portrait
- **WHEN** the latest learner state records `no-evidence-after-revocation` and an older portrait remains in storage
- **THEN** the response SHALL remain an explicit no-eligible-evidence result
- **AND** it SHALL NOT expose the revoked portrait as current cumulative attainment.

## REMOVED Requirements

### Requirement: Teacher attainment views default to cumulative scope
**Reason**: Issue #989 removes the cumulative/recent API switch. A defaulted dual-scope contract would preserve recent portrait behavior and permits ambiguous fallback.

**Migration**: Teacher attainment APIs expose only the canonical cumulative contract. An explicit `scope=recent` request returns an unsupported-scope error.

### Requirement: Cumulative teacher views distinguish attainment from recent signals
**Reason**: Trend, risk, activity interpretation, and diagnosis now belong to the evidence-triggered cumulative portrait. Marking them unavailable in cumulative scope would discard supported state.

**Migration**: Use the last evidence-triggered personal states and current-member distributions in the canonical cumulative response.

### Requirement: Cumulative class insights avoid recent compatibility projection
**Reason**: The recent compatibility projection is deleted, so a conditional rule that merely avoids constructing it on one path is no longer sufficient.

**Migration**: All teacher class portrait reads use immutable `class-competency.cumulative.v2`; removed recent-scope requests fail explicitly.
