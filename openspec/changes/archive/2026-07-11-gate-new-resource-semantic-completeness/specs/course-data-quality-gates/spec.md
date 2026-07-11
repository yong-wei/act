## ADDED Requirements

### Requirement: Newly added resources pass semantic completeness before commit
The course data-quality gates SHALL prevent newly added or modified registered resources from introducing missing reviewed semantic metadata.

#### Scenario: New resource is incomplete
- **WHEN** a new or modified TeachingResource, runtime lesson projection, knowledge card, infograph, simulation, control workbench entry, Arena resource, quiz, exercise, textbook section, reference section, figure, transcript, slide, media anchor, handout, or image description is detected
- **AND** it lacks reviewed disposition, required graph/K/A/Q bindings, path profile, evidence policy, citation metadata, review metadata, or exclusion rationale for its declared role
- **THEN** the new-resource completeness gate SHALL fail before commit.

#### Scenario: Historical backlog exists
- **WHEN** existing historical resources remain incomplete during staged cleanup
- **THEN** the new-resource gate MAY use a reviewed baseline to avoid failing on unchanged historical rows
- **AND** it SHALL still fail on new or modified rows that introduce additional incompleteness.

#### Scenario: Gate is installed in worktree setup
- **WHEN** the worktree sync or hook setup script runs
- **THEN** it SHALL install or update a local commit-time gate for new resource semantic completeness
- **AND** the same check SHALL be available as a direct command for future CI use.
