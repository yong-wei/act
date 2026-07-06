## Design

### Preconditions

The fixture command should refuse to run unless:

- The data completeness helper reports that the targeted resource/graph coverage batch is sufficient for fixture testing.
- The canonical Yang Fan account can be resolved by stable email or student number.
- Duplicate Yang Fan accounts are detected and reported before any write; apply/reset stops until a human-reviewed account operation resolves them.
- The command is running in an allowed local/development/test database context, not `NODE_ENV=production`, not a known production database URL, and with an explicit apply confirmation for any write.

### Fixture Records

The fixture should create or update only governed derived records:

- LearningFacts from existing `UserAnswer` rows and selected path execution outcomes.
- KnowledgeProgress for graph nodes covered by answered questions and selected path resources.
- LearningPathExecution evidenceRefs for completed or started path nodes.
- StudentCompetencySnapshot and StudentProfileSummary entries derived from governed facts.
- StudentEvidenceFeatureCache rebuilt from the derived evidence.
- Adaptive assessment state or answers needed for adaptive-question testing, with traceable fixture provenance.

Fixture output should log only privacy-minimized identifiers by default. It should not print raw answer text, raw event payloads, raw resource content, private memory payloads, or full direct identifiers unless an explicitly privileged local debug flag is used.

### Duplicate Account Handling

The no-email duplicate Yang Fan account should not remain an ambiguous test target. The fixture command must not automatically delete or merge duplicate user records, because the repository does not yet expose a complete, auditable user-relation inventory for proving that account deletion is harmless.

When duplicates are present, the command must report privacy-minimized duplicate candidates, mark the fixture plan as blocked, and require a separate human-reviewed account operation before apply or reset can mutate learner-state records. The command must remain idempotent and produce a dry-run summary before apply mode.

### Production Protection

Dry-run must be the default. Apply mode should require an explicit `--apply` style flag plus database safety checks. The command should refuse to write when the environment appears to be production, when the database host/name matches a configured production denylist, or when the database is not on an allowlist for fixture writes.

### Arena Boundary

The Yang Fan fixture may materialize learning-context evidence around Arena preview or terminal-validation behavior, but official Arena submission score, validity, ranking, leaderboard state, and official evaluation result semantics must remain owned by `ArenaSubmission` and official evaluation records. The fixture must not synthesize official Arena scores as a shortcut for learner-state completeness.

### Test Coverage

Validation should cover:

- Graph node selected in graph page with personalized Konling answer.
- Path planning and path continuation using resources completed by the prior change.
- Adaptive answering state using Yang Fan's fixture evidence.
- Feature cache source coverage no longer reporting `missing-source` for the canonical account.
