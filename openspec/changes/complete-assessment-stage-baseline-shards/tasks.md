## Tasks

- [ ] 1. Select the assessment shard.
  - Generate helper output and select a deterministic shard from the lowest-completeness LearningGoal/stage cells.
  - The shard must be small enough for implementing-agent item-by-item semantic review in one issue, with selected row ids and residual row counts recorded.

- [ ] 2. Review existing candidate items item by item.
  - For every selected candidate, inspect source question, answer/rubric context, source hash, LearningGoal fit, K/A/Q objective ids, graph-node refs, difficulty, cognitive level, stage purpose, and misconception/remediation relation.
  - Record per-item rationale and reject broad, ambiguous, duplicate, stale, or ungrounded candidates.

- [ ] 3. Author minimum new shard items only when needed.
  - Add new diagnostic, practice, checkpoint, or remediation items only for selected shard cells that cannot be satisfied by existing reviewed sources.
  - New items must include full semantic metadata, answer/rubric data, source/version refs, and review rationale.

- [ ] 4. Validate shard coverage.
  - Run `rtk openspec validate complete-assessment-stage-baseline-shards --strict`.
  - Run the assessment coverage helper or targeted catalog tests.
  - Preserve before/after evidence showing selected shard completion and residual unselected counts.
