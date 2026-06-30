## Tasks

- [x] 1. Inventory remaining Arena evidence writeback findings and current projection-only boundaries.
- [x] 2. Define persistent Arena KAQ writeback outcome, idempotency key, limitation model, and consumer contract.
- [x] 3. Implement materialization for accepted official attempts and blocked/degraded outcomes for invalid attempts.
- [x] 4. Update student feedback, teacher publication report, evidence timeline, and path-planning evidence consumers to read persisted outcomes.
- [x] 5. Add tests for persistence, idempotency, invalid attempt blocking, duplicate submission, and consumer consistency.
- [x] 6. Update audit report and evidence with closure ids and residual gaps.

## Validation

- [x] Run `openspec validate audit-remediation-arena-evidence-writeback-persistence --strict`.
- [x] Run targeted Arena submission/writeback/report/evidence tests.
- [x] Attach report diff and representative consumer evidence before marking findings closed.

## Evidence

- Persistent outcome contract: `src/features/arena/evidence-writeback-persistence.ts`
  writes `arena.kaq_evidence_writeback` outbox rows for accepted, degraded, and
  blocked outcomes and creates `LearningFact` only for accepted official
  submissions using a stable multi-field idempotency key. Accepted writes create
  `LearningFact` before publishing a processed outbox outcome; duplicate-only
  same-student repeated submissions are blocked diagnostic outcomes and do not
  create positive mastery facts.
- Submission path: `src/app/api/arena/evaluate/route.ts` returns the persisted
  student projection after materialization.
- Consumer path: `src/features/arena/submissions/prisma-store.ts` attaches
  persisted outcomes to `ArenaSubmissionRecord`; `src/features/arena/teacher/publication-store.ts`
  requests teacher projection for publication reports.
- Ranking path: `src/features/arena/submissions/ranking-policy.ts` excludes
  anything without persisted `accepted` writeback outcome from official ranking,
  personal-best, score summary, and excellent-solution eligibility; `src/features/arena/submissions/prisma-store.ts`
  rebuilds duplicate-only state for same-student repeated
  publication/task/artifact/protocol submissions on Prisma reload without
  treating cross-student evaluation-cache hits as duplicates. A same-context
  retry is only duplicate-only after an earlier submission has a processed
  accepted writeback, so a submission orphaned by writeback failure can be
  retried and materialized.
- Downstream learner-state path: `src/lib/data-governance/adaptive-learner-state-service.ts`
  reads persisted Arena writeback outcomes before constructing evidence timeline,
  path-planning, and Konling learner context; blocked/degraded outcomes are not
  counted as high-confidence official Arena mastery evidence.
- Evidence timeline path: `src/lib/data-governance/evidence-timeline.ts`
  recognizes the persisted accepted Arena `LearningFact` shape
  (`sourceEventId: arena-official:*` and `contextJson.arena.evidenceWriteback`)
  as official Arena evidence instead of preview-only evidence.
- Audit evidence: `artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/remediation/audit-remediation-arena-classroom-evidence/evidence.md`
- Verification run during implementation:
  `rtk npx vitest run src/features/arena/__tests__/arena-evidence-writeback-persistence.test.ts src/features/arena/__tests__/arena-prisma-store.test.ts src/features/arena/__tests__/arena-publication-report.test.ts src/features/arena/__tests__/arena-feedback-rules.test.ts src/features/arena/__tests__/arena-teaching-platform-integration.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts src/lib/data-governance/__tests__/adaptive-learner-state-service.test.ts src/lib/data-governance/__tests__/evidence-timeline.test.ts`
  plus `rtk npm run lint`, `rtk openspec validate audit-remediation-arena-evidence-writeback-persistence --strict`,
  and `rtk proxy git diff --check`.
