## MODIFIED Requirements

### Requirement: Server-derived scope and minimum fields

Each read port SHALL derive subject, tenant, class/course scope and role from server authorization. Client identifiers, query hints or URL descriptors MUST NOT expand scope. The port SHALL return only the minimum fields allowed for that role.

#### Scenario: Teacher reads an owned class session

- **WHEN** an authenticated teacher requests interactive events for a session belonging to a class owned by that teacher
- **THEN** the server derives the class, session, and enrolled-student scope before reading event data
- **AND** the response contains only the teacher-safe projection for that scope

#### Scenario: Teacher targets another class

- **WHEN** a teacher supplies a `sessionId` or `userId` belonging to a class not owned by that teacher
- **THEN** the API rejects the request before querying the target event or response rows

#### Scenario: Request filters narrow but do not grant access

- **WHEN** a teacher supplies `userId`, `sessionId`, `resourceId`, `resourceKey`, or `eventType`
- **THEN** each value is treated only as a filter inside the server-derived class scope
- **AND** no value expands the teacher's readable sessions or students

#### Scenario: Cross-user request

- **WHEN** a student or teacher requests a subject outside the authorized scope
- **THEN** the read port rejects the request before reading or returning projection data

#### Scenario: Role projection

- **WHEN** the same evidence is requested by student, teacher and AI consumers
- **THEN** each receives its role-specific minimum projection and no unauthorized teacher/admin or raw private field

## ADDED Requirements

### Requirement: Interactive teacher reads use a role-minimized projection

Normal teacher interactive-event and diagnostic APIs SHALL return an allowlisted teaching projection rather than raw `InteractionLog` or `StudentStepResponse` rows. The projection MUST exclude direct user identifiers, names, email addresses, raw event payloads, prompts, answers, free text, tokens, stack traces, and provider/parser content.

#### Scenario: Teacher reviews interactive activity

- **WHEN** a teacher requests normal interactive events for an authorized class scope
- **THEN** the API returns canonical event type, safe resource/lesson/step labels, permitted timestamps/status, and safe aggregate counts
- **AND** it does not serialize the underlying raw event or student identity fields

#### Scenario: Private AI question is present

- **WHEN** an `ai_query_submit` event contains a student's question in its event payload
- **THEN** the ordinary teacher response excludes the question and raw payload
- **AND** the question remains available only to a separately authorized historical operation, if one exists

#### Scenario: Diagnostic branch is requested

- **WHEN** a teacher requests control-workbench or annotated-media diagnostics
- **THEN** the branch applies the same server-derived class and roster scope
- **AND** it returns teaching labels and aggregate diagnostics without raw response JSON or direct student identifiers

### Requirement: Raw interactive events are restricted to explicit operations

Raw interactive events MAY be read only by an authorized audit, debug, migration, or drilldown operation carrying a declared purpose, actor scope, source revision, and durable operation receipt. Normal teacher pages and APIs MUST NOT act as raw-event exports or use raw fallback when a projection is unavailable.

#### Scenario: Normal teacher query cannot become a raw export

- **WHEN** a normal interactive-event request asks for event data or a private AI question
- **THEN** the request is rejected or the forbidden fields are omitted according to the safe response contract
- **AND** no raw payload is returned to the caller

#### Scenario: Explicit historical operation is used

- **WHEN** an authorized historical operation requests a raw interactive event
- **THEN** it verifies purpose, actor scope, source revision, and receipt requirements independently of normal consumer permissions
- **AND** raw permission does not flow from ordinary teacher diagnostic access
