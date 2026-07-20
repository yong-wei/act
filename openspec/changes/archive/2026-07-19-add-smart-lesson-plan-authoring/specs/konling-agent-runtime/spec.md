## MODIFIED Requirements

### Requirement: Konling supports teaching-assistant modes
Teaching-assistant modes SHALL expose route-level readiness for the competition assistant workflow, and prep coauthor mode SHALL remain advisory during prep-pack review and smart lesson preparation.

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
- **WHEN** the prep coauthor generates insertion candidates, replacement text, prep-pack updates, or smart-preparation task changes
- **THEN** generated suggestions SHALL remain drafts until the authorized teacher approves them
- **AND** the runtime SHALL NOT insert, publish, replace, or confirm teaching content from client hints or assistant output alone.

#### Scenario: Prep coauthor mode starts from prep-pack review
- **WHEN** a teacher opens prep coauthor mode from a prep-pack review surface
- **THEN** Konling SHALL receive prep-pack, diagnosis, citation, and teacher-review context
- **AND** generated suggestions SHALL remain drafts until teacher approval
- **AND** it SHALL be forbidden from publishing prep items or inserting lesson items directly.

#### Scenario: Prep coauthor mode starts from smart preparation
- **WHEN** a teacher opens prep coauthor mode from `/teacher/smart-prep`
- **THEN** Konling SHALL receive the server-owned smart-task revision, selected course-basis versions, unresolved ambiguities, confirmed decisions, citation state, and teacher-review state
- **AND** session history SHALL remain bound to the owning teacher and exact smart task
- **AND** proposed task changes SHALL require explicit teacher confirmation through the smart-preparation workflow.

#### Scenario: Smart-preparation ambiguity remains unresolved
- **WHEN** prep coauthor mode cannot resolve a required smart-task field to one authorized value
- **THEN** it SHALL expose a clarification turn and structured alternatives
- **AND** it SHALL NOT invoke lesson-plan generation until the teacher confirms one result.
