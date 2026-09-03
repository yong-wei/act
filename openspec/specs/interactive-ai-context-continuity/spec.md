# interactive-ai-context-continuity Specification

## Purpose

Define how the interactive course AI assistant preserves bounded multi-turn
history, resource isolation, and server-validated learning context without
creating a parallel conversation store or writing official learning outcomes.
## Requirements
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

The interactive course AI assistant SHALL use server-validated current resource, course step, progress, completion, persisted learner response, submission and teacher answer-disclosure context as bounded teaching context. Browser-authored prompt extensions, tool lists, response fields or disclosure flags SHALL NOT establish these facts or widen tutoring permissions.

#### Scenario: Current progress is available

- **WHEN** an authenticated learner asks for help during an interactive course resource
- **THEN** the server SHALL resolve the current resource, step and progress context, including the latest persisted response state, from the authorized session/resource state
- **AND** the model context SHALL identify that progress as learning context rather than an official score, mastery conclusion, or learning fact.

#### Scenario: Current response is incomplete

- **WHEN** an authenticated learner asks for help before completely submitting the current interactive response
- **THEN** the server SHALL resolve the latest persisted response state for the authorized session and step
- **AND** the model SHALL provide concepts, observation order or hints without generating a directly submit-ready complete answer or enabling answer checking.

#### Scenario: Current response is completely submitted

- **WHEN** the learner has completely submitted the current step and asks for help
- **THEN** the server SHALL provide a bounded summary of that learner's persisted response for checking and explanation
- **AND** the assistant SHALL NOT rewrite the submission, change an official score or create a learning fact.

#### Scenario: Teacher has disclosed the answer

- **WHEN** the server-owned classroom state confirms that the teacher has disclosed the answer or explanation for the current step
- **THEN** the assistant MAY compare the learner's persisted response with the authorized disclosed material
- **AND** teacher-private answer material for undisclosed steps and other learners' responses SHALL remain unavailable.

#### Scenario: Client submits forged progress

- **WHEN** a client sends altered resource, step, progress, completion, tools, prompt extensions, response fields or answer-disclosure flags
- **THEN** the server SHALL reject or ignore the unverified values before model invocation
- **AND** the client values SHALL NOT enable answer checking, disclose answers or expand the learner's authorized context.

#### Scenario: Progress changes between turns

- **WHEN** the learner saves, submits or receives teacher disclosure before sending the next question
- **THEN** the next request SHALL use the latest server-validated response and progress state
- **AND** earlier conversation messages SHALL remain immutable.

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

