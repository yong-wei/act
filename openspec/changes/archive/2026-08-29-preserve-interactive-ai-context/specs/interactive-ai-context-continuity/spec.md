## ADDED Requirements

### Requirement: Interactive course AI preserves bounded multi-turn context

The interactive course AI assistant SHALL send and restore a bounded, ordered history of the current governed conversation so that a later learner question can refer to earlier turns without crossing the current resource boundary.

#### Scenario: Learner asks a follow-up question

- **WHEN** an authenticated learner sends a second question in the same interactive course AI session
- **THEN** the server SHALL provide the earlier relevant user and assistant messages to the model in stable order
- **AND** the answer SHALL remain scoped to the current interactive resource and course step

#### Scenario: Learner refreshes or reopens the resource

- **WHEN** an authenticated learner refreshes or reopens an interactive resource with an existing AI session
- **THEN** the panel SHALL recover the governed conversation history or show an explicit recovery/unavailable state
- **AND** it SHALL NOT silently present an empty history as if the conversation had never existed

#### Scenario: Learner switches to another resource

- **WHEN** the learner opens a different interactive resource or an incompatible course session
- **THEN** the assistant SHALL isolate the prior resource history according to the governed session boundary
- **AND** messages from the prior resource SHALL NOT be used as the new resource's current teaching context without an authorized page-context transition

### Requirement: Interactive AI uses server-validated course progress context

The interactive course AI assistant SHALL use server-validated current resource, course step, progress, and completion context as bounded teaching context.

#### Scenario: Current progress is available

- **WHEN** an authenticated learner asks for help during an interactive course resource
- **THEN** the server SHALL resolve the current resource and progress context from the authorized session/resource state
- **AND** the model context SHALL identify that progress as learning context rather than an official score, mastery conclusion, or learning fact

#### Scenario: Client submits forged progress

- **WHEN** a client changes resource, step, progress, completion, or other context fields in the request
- **THEN** the server SHALL reject or ignore the unverified values before model invocation
- **AND** the client values SHALL NOT expand the learner's authorized resource context

#### Scenario: Progress changes between turns

- **WHEN** the learner completes or advances an interactive step before sending the next question
- **THEN** the next request SHALL use the latest server-validated progress context
- **AND** earlier conversation messages SHALL remain immutable

### Requirement: Interactive AI session failures are explicit and compatible

The interactive course AI assistant SHALL distinguish a recoverable governed session from a one-turn compatibility path and SHALL preserve existing interactive learning behavior when AI session services are unavailable.

#### Scenario: Governed session cannot be recovered

- **WHEN** an authenticated learner's existing interactive AI session cannot be read or validated
- **THEN** the service SHALL return an explicit unavailable or recovery-required state
- **AND** the UI SHALL provide a retry or return-to-resource action

#### Scenario: Legacy or development caller has no session identity

- **WHEN** a supported legacy or development caller sends an interactive AI request without a persistent session identity
- **THEN** the request MAY use the existing one-turn compatibility behavior
- **AND** the response SHALL NOT claim that the conversation is persisted or recoverable

#### Scenario: AI response is produced

- **WHEN** the interactive course AI returns an explanation or recommendation
- **THEN** the response SHALL remain advisory learning assistance
- **AND** it SHALL NOT automatically write official grades, leaderboard values, LearningFacts, or learner-profile conclusions
