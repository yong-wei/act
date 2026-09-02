## MODIFIED Requirements

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
