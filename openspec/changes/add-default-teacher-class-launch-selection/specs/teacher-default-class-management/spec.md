## ADDED Requirements

### Requirement: Teacher default class is a single active owned preference
The system SHALL maintain one global default class for each teacher who owns at least one active class, and the preference SHALL reference only an active class owned by that teacher.

#### Scenario: Teacher has one active class
- **WHEN** a teacher owns exactly one active class
- **THEN** that class SHALL be the teacher's default class.

#### Scenario: Teacher has no active class
- **WHEN** a teacher owns no active class
- **THEN** the teacher SHALL have no default class
- **AND** teacher classroom launch SHALL remain unavailable until an active class exists.

#### Scenario: Existing teacher preferences are initialized
- **WHEN** the default-class migration processes a teacher with one or more active classes
- **THEN** the active class with the newest creation time SHALL become the default
- **AND** no existing classroom session SHALL be rebound.

### Requirement: Class lifecycle mutations preserve the default invariant
Class creation, activation, deactivation, deletion, and explicit default selection SHALL preserve the teacher default-class invariant atomically.

#### Scenario: Additional class is created or reactivated
- **WHEN** a teacher already has a valid default and creates or reactivates another class
- **THEN** the existing default SHALL remain unchanged.

#### Scenario: First active class becomes available
- **WHEN** a teacher with no active class creates or reactivates a class
- **THEN** that class SHALL become the default.

#### Scenario: Current default becomes inactive or is deleted
- **WHEN** the current default class is deactivated or deleted and other active classes remain
- **THEN** the active class with the newest creation time SHALL become the new default in the same successful operation.

#### Scenario: Concurrent preference mutations
- **WHEN** default selection and class lifecycle mutations execute concurrently for one teacher
- **THEN** the committed result SHALL contain at most one valid default
- **AND** it SHALL contain exactly one default whenever an active owned class remains.

### Requirement: Teacher can identify and change the default class
Teacher class-management surfaces SHALL identify the current default and provide an accessible direct action for setting another active class as default.

#### Scenario: Default class card is rendered
- **WHEN** the teacher opens the class list
- **THEN** the default card SHALL display a top-right diagonal “默认班级” label
- **AND** it SHALL NOT offer a redundant set-default action.

#### Scenario: Non-default active class card is rendered
- **WHEN** a non-default active class card receives pointer hover or keyboard focus
- **THEN** it SHALL expose a “设为默认” action in the top-right action area
- **AND** touch layouts SHALL expose an equivalent persistent action.

#### Scenario: Teacher selects a new default
- **WHEN** the teacher activates “设为默认” for an owned active class
- **THEN** the preference SHALL change without a confirmation dialog
- **AND** the class cards and an accessible status message SHALL reflect the successful result.

#### Scenario: Inactive class is rendered
- **WHEN** a class is inactive
- **THEN** it SHALL NOT offer a set-default action
- **AND** it SHALL NOT appear in classroom launch options.

### Requirement: Launch selection distinguishes persistent default from session class
Teacher launch options SHALL include only owned active classes, and selection for one classroom SHALL not mutate the persistent default.

#### Scenario: Launch starts outside a class route
- **WHEN** a teacher opens a launch dialog without an active class-route context
- **THEN** the valid default class SHALL be preselected.

#### Scenario: Launch starts inside a class route
- **WHEN** a teacher opens a launch dialog from an owned active class route
- **THEN** the current class SHALL be preselected ahead of the global default
- **AND** the teacher SHALL be able to select another owned active class for that classroom.

#### Scenario: Teacher chooses a non-default launch class
- **WHEN** a teacher launches with another owned active class
- **THEN** the new session SHALL bind that selected class
- **AND** the teacher's default preference SHALL remain unchanged.

#### Scenario: Default changes after sessions exist
- **WHEN** the teacher changes the default class
- **THEN** active, finished, and historical sessions SHALL retain their existing class identity.

### Requirement: Shared teacher launch dialog is accessible
The shared teacher launch dialog SHALL expose a stable accessible identity, complete keyboard operation, deterministic focus management, and announced asynchronous states.

#### Scenario: Teacher opens and closes the dialog
- **WHEN** a teacher opens the launch dialog
- **THEN** assistive technology SHALL receive its accessible name
- **AND** initial focus SHALL move to the class selector or the no-class recovery action
- **AND** closing or cancelling SHALL restore focus to the launch control.

#### Scenario: Teacher operates the dialog by keyboard
- **WHEN** a teacher uses only the keyboard
- **THEN** the teacher SHALL be able to select a class, submit, cancel, and dismiss with Escape without encountering an inaccessible control or focus trap.

#### Scenario: Launch options become stale or a request fails
- **WHEN** class options refresh, selected class validation fails, or classroom creation fails
- **THEN** the dialog SHALL remain open with an announced status or error
- **AND** focus SHALL remain at a useful recovery control.
