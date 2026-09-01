# Current-head owner mapping (C2)

Scan revision: `b8c2cce5f6` plus this change. Replacement owner is Personalization unless noted. Deletion condition for every row: zero production imports of the old path after consumer rewrite.

| Old path | Owner | Disposition |
| --- | --- | --- |
| `src/features/adaptive/*.ts(x)` (10 files) | Personalization presentation | moved to `src/features/personalization/experience/` |
| `src/lib/adaptive-*.ts` (16 files) | Personalization path-planning | moved to `src/features/personalization/path-planning/` |
| `src/lib/adaptive-planning/path-constraint-repair.ts` | Personalization path-planning | moved to `src/features/personalization/path-planning/path-constraint-repair.ts` |
| `src/lib/adaptive-planning/resource-ranker.ts` | Personalization path-planning | moved to `src/features/personalization/path-planning/resource-ranker.ts` |
| `src/lib/adaptive-planning/item-type-terminal-validation.ts` | Assessment | moved to `src/features/assessment/item-type-terminal-validation.ts` |

Retained: Prisma tables, LearningFact, outbox, path history. No schema/selector/deploy.
Rollback: restore the preceding code revision `b8c2cce5f6`.
