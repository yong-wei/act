## Tasks

- [ ] 1. Add fixture precondition checks.
  - Require passing data-completeness helper output for graph/resource coverage before Yang Fan fixture generation.
  - Refuse writes in production-like environments or without explicit apply confirmation.

- [ ] 2. Resolve canonical and duplicate Yang Fan accounts.
  - Identify the canonical email/student-number account, report duplicate candidates, and safely delete or migrate the no-email duplicate through an explicit idempotent command.

- [ ] 3. Materialize Yang Fan learning evidence.
  - Create traceable LearningFacts, KnowledgeProgress, path execution evidenceRefs, adaptive assessment records, snapshots, summaries, and feature cache entries from existing answers/path executions and fixture provenance.

- [ ] 4. Add fixture reset and dry-run/apply modes.
  - Ensure repeated runs do not duplicate facts, progress, snapshots, or path evidence.
  - Ensure logs and reports are privacy-minimized by default.

- [ ] 5. Add end-to-end diagnostic tests.
  - Verify graph + Konling, path planning/continuation, and adaptive answering use the canonical account's fixture data and governed resource citations.
  - Verify Arena official scoring boundaries are not overwritten by fixture evidence.

- [ ] 6. Validate the change.
  - Run `rtk openspec validate seed-yangfan-diagnostic-learning-state --strict`.
  - Run targeted fixture, learner-state, path, Konling, and adaptive-answering tests.
  - Verify GitHub blockedBy relationships for upstream data-completeness changes after issues are created.
