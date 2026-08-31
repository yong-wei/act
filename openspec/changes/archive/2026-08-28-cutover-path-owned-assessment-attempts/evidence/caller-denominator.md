# Caller denominator — path-owned Assessment

| Caller | Path | Pre-cutover entry | Required post-cutover entry |
| --- | --- | --- | --- |
| next-question route | `src/app/api/assessment/next-question/route.ts` | local parser + `selectNextQuestionWithPersistenceFallback` | `selectNextPathQuestion` |
| submit-answer route | `src/app/api/assessment/submit-answer/route.ts` | local parser + `submitAnswerWithPersistenceFallback` | `submitPathAnswer` |
| diagnostic route | `src/app/api/assessment/diagnostic/route.ts` | `getDiagnosticWithPersistenceFallback` | `readDiagnostic` |
| ability-report route | `src/app/api/assessment/ability-report/[userId]/route.ts` | `getAbilityReportWithPersistenceFallback` | `readAbilityReport` |
| profile route | `src/app/api/user/profile/route.ts` | same two fallbacks | `readAbilityReport` / `readDiagnostic` |
| adaptive-practice page | `src/app/assessment/adaptive-practice/page.tsx` | HTTP `/api/assessment/*` | unchanged HTTP; server authority is public API |
| Konling companion | `src/lib/konling-continuity-assessment.ts` | metadata verify, then fallback | verify stays; writes go through public API |
| diagnosis context | `src/features/assessment/adaptive-diagnosis-context.ts` | `readAdaptiveAttemptContext` | `readAttemptContext` |
| generate-question route | `src/app/api/assessment/generate-question/route.ts` | `generateQuestion` Map write | remains template generation; not path-owned attempt write |
| admin data-governance | `src/app/api/admin/data-governance/status/route.ts` | `prisma.userAnswer.findMany` | keep as non-Assessment read |
| extracurricular analytics | `src/lib/extracurricular-analytics.ts` | `prisma.question` / `userAnswer` | keep as non-Assessment read |

Auth/contract tests: `src/features/assessment/__tests__/assessment-route-auth.test.ts`, `adaptive-persistence.test.ts`, `src/lib/data-governance/__tests__/profile-route.test.ts`.
