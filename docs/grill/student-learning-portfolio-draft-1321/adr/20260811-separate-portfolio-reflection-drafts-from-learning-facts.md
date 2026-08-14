# Keep portfolio reflection drafts separate from learning facts

Portfolio reflection drafts use a learner-owned persistence model rather than `LearningNote`, `LearningEvidenceDraft`, or `LearningFact`. The chosen model keeps the explicit-save candidate workflow recoverable and editable while preventing unverified AI-assisted reflection content from affecting official scores, competency evidence, or learner portraits.

## Considered Options

- Reuse `LearningNote`: rejected because it cannot preserve task provenance, lifecycle status, or idempotent save identity.
- Promote directly to `LearningFact`: rejected because a student draft is not verified learning evidence and must not affect learner portraits.
- Persist the complete Copilot conversation: rejected because the selected workflow saves the displayed structured candidate only and avoids retaining unrelated private chat content.

## Consequences

The save API accepts only a bounded structured candidate for the authenticated student and records a draft lifecycle. A future explicit promotion workflow requires its own governed change; this change provides no automatic portfolio publication or learning-state writeback.
