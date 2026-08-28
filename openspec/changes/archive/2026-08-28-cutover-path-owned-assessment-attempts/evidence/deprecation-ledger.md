# Deprecation ledger — path-owned Assessment authority

Revision: implementation of `cutover-path-owned-assessment-attempts` on branch `cutover-path-owned-assessment-attempts`.

| Deleted or retired entry | Previous consumers | Replacement public API | Deletion condition |
| --- | --- | --- | --- |
| `selectNextQuestion` (Map asked-set) | `selectNextQuestionWithPersistenceFallback` when flag false | `selectNextPathQuestion` → `selectNextQuestionDurably` | no remaining imports |
| `submitAnswer` / `submitAnswerWithDetails` (Map answers) | fallback submit | `submitPathAnswer` → `submitAnswerDurably` / `createSubmitAnswerDetails` | no remaining imports |
| `getAbilityReport` / `getDiagnostic` (Map answers) | fallback reports, profile | `readAbilityReport` / `readDiagnostic` | no remaining imports |
| `isAdaptiveAssessmentPersistenceEnabled` | fallback wrappers | `assertDurableAssessmentPersistence` fails closed on `'false'` | no remaining imports |
| `*WithPersistenceFallback` | next-question, submit-answer, diagnostic, ability-report, profile | Assessment `public-api.ts` | no remaining imports |
| `readVerifiedPathContext` in next-question and submit-answer routes | those two routes | `resolvePathAssessmentIdentity` | routes no longer contain the parser |
| `sessions` / `answersByUser` Maps | engine Map authority | Prisma `AdaptiveAssessmentSession` / `AdaptiveAssessmentAnswer` | store no longer has those maps |

Retained, not path-owned attempt authority:

| Entry | Reason |
| --- | --- |
| `generatedQuestions` Map | template `generateQuestion` lookup until `retire-legacy-adaptive-entrypoints`; path-owned next/submit use reviewed catalog + durable session |
| `Question` / `UserAnswer` Prisma tables | admin data-governance and extracurricular analytics still read them; Assessment writes do not use them |
