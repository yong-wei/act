## Context

Admin governance remediation added objectized actions and representative exports. Remaining issues are durable operation states: import batches, rollback availability, configuration diff/impact, refresh/download announcements, and mobile action placement.

## Design

1. Operation ledger.
   - Admin operations create or display an operation id, actor, object scope, started/completed timestamps, outcome, downloadable artifact refs, rollback availability, and audit summary.
   - Operation records also include source file hash, idempotency key, artifact retention policy, and role-scoped download authorization.
   - Downloadable failed-row artifacts minimize personally identifiable information and expire or become revocable.
   - Ledger entries cover import preview/commit, failed-row download, template download, config save/test, governance refresh/export, and stats export.

2. Import batch lifecycle.
   - Preview, confirm, partial failure, failed-row export, notification, rollback possible, rollback unavailable, and completed states must be distinct.
   - Upload controls use import-specific accessible names and cannot reuse unrelated labels such as search.
   - If rollback cannot be implemented in the same phase, the UI must state why and preserve audit evidence.

3. Configuration impact.
   - Provider/model/config saves show diff summary, affected provider/model, runtime impact, and audit feedback.
   - Save/test actions must not silently switch active provider or create empty provider drafts.

4. Mobile admin action zones.
   - Key actions remain reachable without horizontal page overflow.
   - Status feedback remains visible near the initiating control.

## Out Of Scope

- Graph Center diagnostics, KAQ governance, resource metadata completion, and path planner evidence.
