# learning-record-consumers Specification

## ADDED Requirements

### Requirement: Consumers use stable Learning Record read ports

Student, teacher, AI and Personalization consumers SHALL read governed current projections through stable role-appropriate ports. Normal page/runtime code MUST NOT scan or aggregate raw events as a second evidence source.

#### Scenario: Student route reads current evidence

- **WHEN** an authenticated student requests evidence
- **THEN** the route reads the student-safe port and receives revision, status and provenance metadata without raw event aggregation

#### Scenario: Projection is unavailable

- **WHEN** the current projection is unavailable or stale
- **THEN** the port returns the explicit status/limitation and the consumer does not silently rebuild from raw events

### Requirement: Server-derived scope and minimum fields

Each read port SHALL derive subject, tenant, class/course scope and role from server authorization. Client identifiers, query hints or URL descriptors MUST NOT expand scope. The port SHALL return only the minimum fields allowed for that role.

#### Scenario: Cross-user request

- **WHEN** a student or teacher requests a subject outside the authorized scope
- **THEN** the read port rejects the request before reading or returning projection data

#### Scenario: Role projection

- **WHEN** the same evidence is requested by student, teacher and AI consumers
- **THEN** each receives its role-specific minimum projection and no unauthorized teacher/admin or raw private field

### Requirement: Truthful status, provenance and small-sample handling

Consumer ports SHALL preserve projection status, coverage, freshness, confidence, watermark, revision and permitted provenance. Known zero SHALL remain distinct from missing, partial, stale or unavailable. Teacher aggregate suppression SHALL count independent learners, not rows or events.

#### Scenario: Small teacher cohort

- **WHEN** an aggregate has fewer than the independent-learner threshold
- **THEN** sensitive values are suppressed while status and coverage remain truthful

#### Scenario: Stale evidence is shown

- **WHEN** a newer LearningFact exists without a qualified replacement projection
- **THEN** the consumer marks the result stale/limited and does not label it current or fresh

### Requirement: Ground Evidence Copilot contract is preserved

The ground-evidence-copilot consumer SHALL continue to resolve evidence on the server for the authenticated student. URL `source`, `assignment` and `intent` values MAY be navigation or goal hints only; they MUST NOT authorize, create or replace evidence. Copilot answers SHALL remain advisory and MUST NOT write official scores, LearningFacts or profile claims.

#### Scenario: Tampered Copilot hint

- **WHEN** a student changes an Evidence Copilot URL descriptor to another source or learner
- **THEN** the server keeps the authenticated student's governed scope and returns truthful status/limitations

#### Scenario: Ordinary Copilot request

- **WHEN** a request has no Evidence context
- **THEN** ordinary Copilot behavior remains compatible and no new evidence permission is inferred

### Requirement: Raw access is restricted to explicit operations

Raw events MAY be read only for authorized audit, debug, migration or drilldown operations carrying a purpose and revision-bound receipt. Pages, normal APIs, AI context and Personalization runtime MUST NOT use raw fallback to bypass a projection status.

#### Scenario: Raw fallback attempt

- **WHEN** a normal consumer cannot obtain a current projection
- **THEN** it returns the governed unavailable/stale state and does not query raw event history

### Requirement: Consumer migration denominator is closed

Migration SHALL enumerate all consumer routes, pages, services, workers, backfills and reports, their current raw/legacy callers, replacement port, owner and deletion condition. A consumer is migrated only when its output, privacy, status and provenance evidence is bound to a projection revision.

#### Scenario: Legacy reader deletion

- **WHEN** a legacy reader is proposed for removal
- **THEN** the ledger proves zero required callers, replacement receipts and aligned backfill/report paths before deletion

### Requirement: Consumer payloads use an allowlist and cannot inherit raw authority

Read ports SHALL expose only opaque subject/scope references, stable object identity, normalized values, trusted/server times, revision/captureRevision, source summary, status, coverage, freshness, confidence and permitted provenance. They MUST reject generic payload JSON, raw answers, free text, prompts, model/parser text, direct user IDs, exception/stack text and tokens. Restricted raw artifacts SHALL default off and remain in separate physical/key/ACL domains; queue, fact and consumer permissions MUST NOT inherit access.

#### Scenario: Consumer payload contains a forbidden field

- **WHEN** a page, AI context or Personalization request attempts to persist or export a forbidden field
- **THEN** the allowlist/sanitizer rejects it and emits only a redacted diagnostic receipt

#### Scenario: Copilot needs evidence context

- **WHEN** ground-evidence-copilot resolves context for an authenticated student
- **THEN** it receives the existing server-authorized safe projection or opaque raw reference metadata, never raw artifact content or a new permission scope

### Requirement: Consumer retention and export are bounded

Consumer transport and successful payloads SHALL be deleted within 24 hours after successful use; failure receipts SHALL default to 30 days and be capped at 90 days; approved raw artifacts SHALL default to disabled and be capped at 7 days after approval; public audit SHALL be minimal aggregation with a default 90-day bound. Exports MUST exclude raw answers, prompts, model/parser text, reversible user IDs, raw artifacts, tokens, addresses, local paths and identifying small samples.

#### Scenario: Expiry cleanup completes

- **WHEN** a consumer artifact reaches its retention bound
- **THEN** a deletion receipt is written and object, index, cache and replica unreadability is verified before access is considered closed

### Requirement: Sanitizer and unknown data fail closed

New consumer writes SHALL use explicit allowlists. Legacy JSON MAY be read only through a versioned sanitizer in an isolated authorized operation. Unknown fields/version/digest/retention/ref or ACL drift MUST fail closed, and rollback MUST NOT restore broad raw JSON or raw-artifact permissions.

#### Scenario: Legacy payload has an unknown field

- **WHEN** a legacy consumer payload contains an unrecognized field or schema version
- **THEN** the sanitizer refuses the payload and does not pass it to a normal read port or export
