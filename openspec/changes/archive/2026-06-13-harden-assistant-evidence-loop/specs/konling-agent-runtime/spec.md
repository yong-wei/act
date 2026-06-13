## MODIFIED Requirements

### Requirement: Konling supports teaching-assistant modes
Teaching-assistant modes SHALL expose route-level readiness for the competition assistant workflow.

#### Scenario: Assistant mode readiness is requested
- **WHEN** diagnosis explainer, path advisor, grading assistant, feedback explainer, class summarizer, or prep coauthor mode is mounted on a supported route
- **THEN** the runtime SHALL return `ready`, `degraded`, or `unavailable`
- **AND** unavailable states SHALL include missing required context, unsupported role, missing citation class, or unknown mode reasons.

#### Scenario: Diagnosis explainer mode starts
- **WHEN** Konling opens from a learning diagnosis surface
- **THEN** it SHALL load the server-owned diagnosis view, learner-state summary, relevant evidence citations, permitted tools, and missing-context state.

#### Scenario: Required context is present
- **WHEN** a mode has its required server-owned context and citation classes
- **THEN** the mode SHALL expose permitted tools and safe scope metadata
- **AND** client-supplied hints SHALL NOT override server-verifiable permissions or target identity.

#### Scenario: Grading assistant prepares write-capable output
- **WHEN** the grading assistant prepares feedback, score changes, or diagnosis-affecting output
- **THEN** generated output SHALL remain a draft until the grading workflow records an explicit approval action
- **AND** the runtime SHALL NOT approve grading, write back profiles, or mutate governed evidence from assistant context alone.

#### Scenario: Grading assistant mode starts
- **WHEN** Konling opens from a teacher grading workbench
- **THEN** it SHALL load rubric, converted document references, draft grading state, teacher review state, citation requirements, and role-scoped permissions
- **AND** it SHALL NOT approve grading or write back profiles without the grading workflow approval action.

#### Scenario: Prep coauthor proposes lesson material
- **WHEN** the prep coauthor generates insertion candidates, replacement text, or prep-pack updates
- **THEN** generated suggestions SHALL remain drafts until the authorized teacher approves them
- **AND** the runtime SHALL NOT insert, publish, or replace prep-pack material from client hints or assistant output alone.

#### Scenario: Prep coauthor mode starts
- **WHEN** Konling opens from a prep-pack page
- **THEN** it SHALL load class diagnosis, candidate prep items, evidence references, insertion targets, and teacher review state
- **AND** generated suggestions SHALL remain drafts until teacher approval.

### Requirement: Mode fallback is explicit
Mode fallback SHALL be user-visible and testable.

#### Scenario: Required mode context is unavailable
- **WHEN** a teaching-assistant mode lacks required context or citations
- **THEN** the mode SHALL be unavailable or degraded with a clear reason
- **AND** mode dependencies including diagnosis, path, grading, prep-pack, or citation context SHALL be represented in that unavailable or degraded state
- **AND** it SHALL NOT generate authoritative recommendations from generic chat context alone.
