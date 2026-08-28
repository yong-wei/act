# Characterization — cutover-path-owned-assessment-attempts

Captured on implementation branch `cutover-path-owned-assessment-attempts` at `8719b7641` (post-#1667 integration).

## 1.1 Dependency gate

| Input | Status | Evidence |
| --- | --- | --- |
| `reconcile-reviewed-assessment-generation-governance` | archived 2026-08-28 | `openspec/changes/archive/2026-08-28-reconcile-reviewed-assessment-generation-governance/` |
| reviewed catalog / generation kind / publication receipt | frozen by that archive | canonical `openspec/specs/reviewed-assessment-generation-governance/spec.md` |
| `establish-modular-monolith-refactor-charter` | qualified, archived | `openspec/changes/archive/2026-08-26-establish-modular-monolith-refactor-charter/` |
| `enforce-modular-domain-dependency-contracts` | qualified, archived | `openspec/changes/archive/2026-08-26-enforce-modular-domain-dependency-contracts/` |

This change consumes the reviewed catalog selector and generated publication receipt. It does not add catalog schema.

## 1.3 Pre-cutover authorities (must become fail-closed)

| Authority | Location | Pre-cutover behavior |
| --- | --- | --- |
| `globalThis.__adaptiveAssessmentStore.sessions` | `src/features/assessment/adaptive-engine.ts` | process-local asked set for `selectNextQuestion` |
| `globalThis.__adaptiveAssessmentStore.answersByUser` | same | process-local answers for `submitAnswer` / diagnostic / ability report |
| `generatedQuestions` | same store | generate-question lookup cache; also visible to `allQuestions()` practice pool |
| `ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED=false` | `isAdaptiveAssessmentPersistenceEnabled` | routes Map-backed `selectNextQuestion` / `submitAnswer` / reports |
| `*WithPersistenceFallback` | `adaptive-persistence.ts` | public entry used by routes and profile |
| path-context parser copy 1 | `src/app/api/assessment/next-question/route.ts` `readVerifiedPathContext` | Prisma `learningPath` ownership + stage inference |
| path-context parser copy 2 | `src/app/api/assessment/submit-answer/route.ts` `readVerifiedPathContext` | same algorithm, different error strings and returned `pathContext` |

Durable Prisma path already exists (`submitAnswerDurably`, optimistic `selectedQuestionIds` retry). Flag `false` skips it except companion practice, which already throws.
