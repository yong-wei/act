# Persist authenticated prompt assessment history as learner-owned process evidence

Prompt quality and consistency assessments SHALL be stored as learner-owned, authenticated process records in `PromptAssessment`, rather than in process memory or as immediate `LearningFact` entries. The assessment request creates a versioned record for the authenticated student and evaluation session; the consistency request updates only the corresponding owned record.

## Considered Options

- Keep the process-local map and add an ownership check: rejected because restart and multi-instance execution still lose or split evidence.
- Convert every evaluation directly into `LearningFact`: rejected because a prompt-quality or process-consistency result is useful learning-process feedback but is not independently governed competency evidence.
- Persist in `PromptAssessment` with authentication, user-scoped reads, session/version identity, and an attached consistency result: selected because the existing model already owns the relevant raw evaluation payload and score dimensions without prematurely changing portrait semantics.

## Consequences

The evaluation routes must require an authenticated student before reading or writing data and ignore caller-supplied identity. The data model retains bounded task context and consistency results with the assessment record, while the history API exposes only the owner's records. Version allocation must preserve a unique student/session/version identity under retry or concurrent submission. A later proposal must explicitly govern any `LearningFact` materialization or learner-profile contribution.
