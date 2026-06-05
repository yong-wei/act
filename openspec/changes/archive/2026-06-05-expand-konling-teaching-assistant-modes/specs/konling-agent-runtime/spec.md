## ADDED Requirements

### Requirement: Konling supports teaching-assistant modes
Konling SHALL expose registered teaching-assistant modes with explicit context, tool, citation, and privacy contracts.

#### Scenario: Diagnosis explainer mode starts
- **WHEN** Konling opens from a learning diagnosis surface
- **THEN** it SHALL load the server-owned diagnosis view, learner-state summary, relevant evidence citations, permitted tools, and missing-context state.

#### Scenario: Grading assistant mode starts
- **WHEN** Konling opens from a teacher grading workbench
- **THEN** it SHALL load rubric, converted document references, draft grading state, teacher review state, citation requirements, and role-scoped permissions
- **AND** it SHALL NOT approve grading or write back profiles without the grading workflow approval action.

#### Scenario: Prep coauthor mode starts
- **WHEN** Konling opens from a prep-pack page
- **THEN** it SHALL load class diagnosis, candidate prep items, evidence references, insertion targets, and teacher review state
- **AND** generated suggestions SHALL remain drafts until teacher approval.

### Requirement: Mode fallback is explicit
Konling SHALL expose missing or unavailable mode dependencies rather than silently downgrading to generic chat.

#### Scenario: Required mode context is unavailable
- **WHEN** a mode requires diagnosis, path, grading, prep-pack, or citation context that is not available
- **THEN** the runtime SHALL return a visible unavailable or degraded state
- **AND** it SHALL NOT invent authoritative personalized claims from client hints.
