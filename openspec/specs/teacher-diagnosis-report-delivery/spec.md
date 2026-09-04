# teacher-diagnosis-report-delivery Specification

## Purpose
Define fixed, role-safe diagnosis report delivery artifacts and auditable teacher actions without changing diagnosis evidence, creating teaching objects, or sending reports automatically.
## Requirements
### Requirement: Delivery projections bind to an immutable diagnosis version
The system SHALL derive every teacher or student-safe delivery projection from one persisted diagnosis report, a projection version, a role version, and an audience identity when applicable. Repeating a projection with the same inputs SHALL preserve the same content identity and SHALL NOT generate another diagnosis.

#### Scenario: Teacher repeats an export
- **WHEN** an authorized teacher exports the same report with the same projection and role versions
- **THEN** the system SHALL return the same artifact identity and content hash
- **AND** it SHALL append an export audit event without creating another diagnosis report.

#### Scenario: Delivery inputs change
- **WHEN** the persisted report, projection version, role version, or student audience changes
- **THEN** the system SHALL use a different delivery identity.

### Requirement: Teacher delivery remains authorized and privacy-safe
The system SHALL authorize teacher detail, print, PDF, evidence, and action reads from the server-owned session and current class ownership. Teacher delivery SHALL omit raw answers, private dialogue, hidden assessment content, raw evidence payloads, and opaque evidence-reference identifiers.

#### Scenario: Non-owner requests a teacher report
- **WHEN** a teacher who does not own the report class requests a teacher delivery surface or PDF
- **THEN** the server SHALL reject the request without exposing report metadata or artifact existence.

#### Scenario: Teacher inspects a conclusion
- **WHEN** a teacher expands a report finding
- **THEN** the system SHALL show an allowlisted evidence-source summary or an explicit unavailable reason
- **AND** it SHALL NOT expose raw evidence identifiers or values.

### Requirement: Student delivery is an independent safe projection
The student-safe projection SHALL be available only for a student-scoped report. It SHALL contain the target student's personal conclusions, evidence summary, limitations, suggestions, cutoff, and version, and SHALL exclude peer data, class distributions, teacher-only explanation, force reasons, internal disposition, raw answers, private dialogue, hidden assessment content, and opaque evidence references.

Suggestions SHALL be a deterministic, auditable projection of persisted structured findings. Each suggestion SHALL expose its stable report/finding target and a source marker, and it SHALL NOT invoke a model, mutate the diagnosis report, or expose raw evidence references.

#### Scenario: Student reads their own report
- **WHEN** the authenticated target student requests the student-safe page or PDF
- **THEN** the server SHALL return only that report's student-safe projection.
- **AND** each delivered suggestion SHALL be stable for the persisted report version and contain no opaque evidence identifier.

#### Scenario: Teacher previews a student-safe report
- **WHEN** the owning teacher requests a student-safe projection for a current class member
- **THEN** the server SHALL return the same role-versioned content used for that student audience.

#### Scenario: Class report has no personal projection
- **WHEN** a student-safe projection is requested from a class-scoped report
- **THEN** the server SHALL fail closed rather than infer personal conclusions from class findings.

### Requirement: PDF delivery is reproducible and auditable
The system SHALL generate teacher and student-safe PDFs on the server with A4 pagination, embedded Chinese-capable fonts, a report-version footer, and deterministic content. It SHALL persist artifact identity, content hash, artifact hash, projection and role versions, audience, creator, and creation time, and SHALL record each successful export actor and time.

#### Scenario: PDF generation succeeds
- **WHEN** an authorized actor exports a valid fixed projection
- **THEN** the response SHALL download the corresponding PDF
- **AND** the export ledger SHALL bind the actor to the stable artifact.

#### Scenario: PDF generation fails
- **WHEN** projection validation, font loading, rendering, storage, or authorization fails
- **THEN** the system SHALL return an explicit failure and recovery message
- **AND** it SHALL NOT record a successful export or send a report.

### Requirement: Teaching actions use existing authorized destinations only
The teacher delivery surface SHALL offer student detail, preparation, and remediation-resource links only when the destination is server-authorized and already exists. Opening a destination SHALL NOT create a preparation pack, remediation task, intervention, or assignment.

#### Scenario: Registered remediation resource exists
- **WHEN** a finding has a governed knowledge-node binding and an accessible registered teaching resource
- **THEN** the teacher MAY open that existing destination from the report.

#### Scenario: No registered resource exists
- **WHEN** no accessible registered resource is bound to the finding
- **THEN** the report SHALL state that no registered remediation resource is available
- **AND** it SHALL NOT manufacture a link.

### Requirement: Teacher disposition is append-only and separate from risk
The system SHALL allow the owning teacher to record viewed, pending, intervention-arranged, and completed disposition events against a report or stable finding target. Each event SHALL retain teacher, report, target, action, optional existing-action reference, idempotency identity, result, and time. Disposition SHALL NOT modify diagnosis content, evidence-derived risk, learner state, grade, or trend.

#### Scenario: Teacher records a disposition
- **WHEN** the owning teacher records an allowed action with a valid idempotency identity
- **THEN** the server SHALL append or return one matching audit event
- **AND** authorized report reads SHALL show the latest disposition independently from risk severity.

#### Scenario: Teacher completes handling
- **WHEN** the latest disposition becomes completed while supporting risk remains current
- **THEN** the interface SHALL continue to show the original risk judgment
- **AND** it SHALL identify only the human handling state as completed.

#### Scenario: Invalid action reference is supplied
- **WHEN** an intervention-arranged event references an unauthorized, missing, or automatically requested object
- **THEN** the server SHALL reject the event without creating that object or appending a success record.

### Requirement: Delivery surfaces support presentation and recovery
Teacher and student-safe report pages SHALL provide print-ready desktop layouts and usable 320px controls. Loading, empty, unauthorized, export-failed, and action-failed states SHALL explain the result and provide an allowed recovery action.

#### Scenario: Teacher presents a report
- **WHEN** the teacher opens the fixed report detail at desktop width or prints it
- **THEN** the report SHALL preserve readable hierarchy, evidence cutoff, version footer, and privacy labels.

#### Scenario: Mobile delivery action fails
- **WHEN** export or disposition fails at 320px width
- **THEN** the failure reason and retry or return action SHALL remain visible without horizontal loss of the report content.

### Requirement: Diagnosis delivery controls are print-only

The teacher and student-safe report delivery headers SHALL provide the browser print action and SHALL NOT render or invoke a direct PDF-export action. Existing server-side PDF artifacts, audit records, and already-published PDF endpoints are outside this UI change.

#### Scenario: Teacher opens a fixed report
- **WHEN** an authorized teacher opens the teacher delivery page
- **THEN** the header SHALL show the print control
- **AND** SHALL NOT show an export-PDF control or issue a PDF request.

#### Scenario: Student opens a safe report
- **WHEN** an authenticated student opens a student-safe report
- **THEN** the header SHALL show the print control
- **AND** SHALL NOT show an export-PDF control or issue a PDF request.

### Requirement: Teacher report-level preparation entry is always available

The teacher report disposition area SHALL link to the existing smart preparation workspace without creating a preparation task. This action SHALL remain available when the report is class-scoped or its findings have no knowledge-node mapping.

#### Scenario: Teacher opens a class report without mapped knowledge nodes
- **WHEN** an authorized teacher opens the teacher delivery page for a class report whose findings omit knowledge-node identifiers
- **THEN** the report disposition area SHALL show the smart preparation workspace entry
- **AND** it SHALL NOT create or alter a preparation task.

#### Scenario: Local textbook runtime is not materialized
- **WHEN** the teacher follows the report-level preparation entry in a local environment without the optional structured-textbook runtime directory
- **THEN** the smart preparation workspace SHALL remain available with an empty textbook catalog
- **AND** it SHALL NOT fail the diagnosis-report handoff.

### Requirement: Attribution-limited status requires knowledge-node findings

The teacher diagnosis history projection SHALL mark a report attribution-limited only when a finding that requires knowledge-node attribution is missing `knowledgeNodeId`. A finding requires knowledge-node attribution when it cites at least one `knowledge-progress:` evidence reference. Findings about overall risk, score distribution, or class coverage SHALL NOT by themselves mark the report as coverage-limited.

When attribution limitation is the only confidence reason — the report's data coverage is complete and no other evidence boundary applies — the availability state and recovery advice SHALL describe the knowledge-node attribution problem explicitly and SHALL NOT describe it as data coverage limitation. Reports with genuine student, assignment, assessment, or behavior coverage gaps SHALL keep the existing data coverage limitation wording.

#### Scenario: Knowledge-progress finding lacks a node

- **WHEN** a persisted finding cites `knowledge-progress:` evidence and has no `knowledgeNodeId`
- **THEN** the history projection SHALL set attribution-limited
- **AND** it SHALL keep a recovery action to complete knowledge-node mapping

#### Scenario: Overall risk or score distribution lacks a node

- **WHEN** a finding describes overall risk or score distribution and has no `knowledgeNodeId`
- **AND** it does not cite `knowledge-progress:` evidence
- **THEN** the history projection SHALL NOT set attribution-limited solely because of that finding

#### Scenario: Mixed findings with complete coverage

- **WHEN** assignment, assessment, student, and learning-behavior coverage are complete
- **AND** the report declares no limitations
- **AND** only non-knowledge-node findings omit `knowledgeNodeId`
- **THEN** the history projection SHALL display an availability state consistent with the persisted complete coverage
- **AND** it SHALL NOT show coverage-limited solely because of those findings

#### Scenario: Attribution limitation is the only confidence reason

- **WHEN** a report's data coverage is complete with no declared data limitations
- **AND** the only confidence reason is a knowledge finding without a node
- **THEN** the availability state SHALL be described as knowledge-node attribution limitation
- **AND** it SHALL NOT use the data coverage-limited wording.

### Requirement: Browser print outputs only the report deliverable

The teacher delivery surface SHALL scope browser print output to the report deliverable itself: the report title, notice, metadata, summary, findings, evidence summaries, suggestions, limitations, and version footer. The platform shell chrome SHALL be excluded from print output, including breadcrumbs, workspace title and subtitle, theme switcher, user menu, platform navigation sidebar, mobile navigation and its drawer entry, workspace command-bar tab rows, and floating web-only controls. Browser-generated print headers and footers remain owned by the browser settings and SHALL NOT be suppressed or replaced by the application. Normal on-screen navigation and interactions SHALL be unchanged.

#### Scenario: Teacher prints the fixed report from Edge

- **WHEN** an authorized teacher opens the teacher delivery page in Edge and invokes the browser print preview
- **THEN** the preview SHALL contain the report deliverable content and preserve the browser-generated date and site-title header
- **AND** the preview SHALL NOT contain the app shell chrome, navigation tabs, user menus, the print button, the sidebar, or other web-only controls.

#### Scenario: Report content paginates

- **WHEN** the report deliverable content spans multiple printed pages
- **THEN** the content SHALL paginate without occlusion, horizontal clipping, or truncation of key report content.

#### Scenario: Screen presentation is unchanged

- **WHEN** the teacher browses the delivery page without printing
- **THEN** the platform shell navigation, header, and workspace tabs SHALL render exactly as before
- **AND** no new export entry point SHALL be introduced.

### Requirement: Teacher delivery surface copy is Simplified Chinese

The teacher delivery surface SHALL present its fixed interface copy, including the governed-report eyebrow above the report title, in Simplified Chinese. Technical values such as report version identifiers, enum-derived labels that already have Chinese label mappings, and browser-generated print headers remain exempt.

#### Scenario: Teacher opens a fixed report

- **WHEN** an authorized teacher opens the teacher delivery page
- **THEN** the eyebrow above the report title SHALL read Simplified Chinese governed-report copy
- **AND** the page SHALL NOT render the previous English "Fixed governed report" eyebrow.

### Requirement: Evidence-conflict downgrades surface a structured confidence reason

When a persisted report's confidence is below `high` because of a verified cross-source evidence conflict while student, assignment, assessment, and learning-behavior coverage are complete, the teacher report history projection SHALL produce a structured confidence reason describing the evidence conflict, and the availability state, reason, and recovery action SHALL point to the conflict and teacher re-review rather than to data coverage. The projection SHALL NOT treat natural-language conflict wording alone as a verified conflict. Unverifiable historical conflict claims SHALL be presented as needing regeneration or manual review, not as「证据存在冲突」. The generic "no verifiable confidence reason / supplement verifiable evidence" fallback SHALL be used only when no structured reason of any known kind applies, and SHALL NOT appear when coverage is complete and a declared limitation or verified conflict explains the downgrade.

#### Scenario: Complete coverage with a declared evidence conflict

- **WHEN** a report has `sourceCoverage.coverage = 1`, zero missing assignment and assessment students, a declared cross-source conflict limitation with confidence `medium`, and verified same-student close-window opposite-direction cited evidence
- **THEN** the history projection SHALL describe the downgrade as an evidence conflict with a teacher re-review recovery action
- **AND** SHALL NOT show a coverage-gap recovery suggestion or the generic supplement-evidence fallback.

#### Scenario: Unverifiable historical conflict wording

- **WHEN** a complete-coverage medium-confidence report contains conflict wording but the cited evidence is missing, cross-student, equal-score, wrong-direction, or otherwise unverifiable
- **THEN** the history projection SHALL present the report as needing regeneration or manual review
- **AND** it SHALL NOT label the availability state as「证据存在冲突」.

#### Scenario: Generic fallback only as last resort

- **WHEN** a report's confidence is below `high` and no coverage gap, attribution limitation, declared limitation, or evidence conflict explains it
- **THEN** the projection MAY use the generic fallback reason
- **AND** genuine coverage gaps, attribution limitations, and behavior-source absences SHALL keep their existing accurate states.

