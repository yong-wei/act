## ADDED Requirements

### Requirement: Platform errors shall render product recovery states
Invalid ids, stale links, missing objects, unauthorized role access, and classroom-code failures SHALL render product-owned recovery UI instead of raw Next errors, raw object ids, or silent redirects.

#### Scenario: Invalid object route
- **WHEN** a user opens a known platform route with an invalid object id
- **THEN** the page SHALL identify the object type and safe display reference
- **AND** it SHALL offer recovery actions such as return, search, retry, or request access
- **AND** it SHALL emit `role="alert"` or `role="status"` according to severity.

#### Scenario: Permission boundary
- **WHEN** a user reaches a route that belongs to another role
- **THEN** the UI SHALL explain the role boundary without exposing private object data
- **AND** the event SHALL be inspectable as an auditable permission state.

### Requirement: Platform transient surfaces shall have consistent focus behavior
Menus, dialogs, floating tool panels, and recovery actions SHALL expose semantic roles, keyboard order, Escape behavior, and opener focus restoration.

#### Scenario: Floating tool menu
- **WHEN** a user opens and closes a global floating tool menu by keyboard
- **THEN** focus SHALL remain inside the transient surface while it is open
- **AND** focus SHALL return to the opener after close
- **AND** mobile safe-area behavior SHALL prevent primary content obstruction.

### Requirement: P0 stability closures shall remain guarded
Registration short-password errors and prep-pack storage absence SHALL stay product recovery states.

#### Scenario: Regression check
- **WHEN** remediation validation runs
- **THEN** it SHALL prove registration validation errors do not render React child objects
- **AND** prep-pack routes do not return a raw 500 for missing storage.

