## 1. Reproduce and lock the authority boundary

- [ ] 1.1 Add failing tests proving the production control workbench still exposes the client-authored `AICompanionPanel` and can submit hand-entered parameters, metrics and outcome.
- [ ] 1.2 Add route/runtime regressions proving an Arena request with only client `studentState`, task and method cannot create `AIIntervention`, evidence, Memory, feedback identity or cooldown state.
- [ ] 1.3 Add official-companion reader tests proving legacy interventions without a verified official submission reference are excluded from baselines and follow-up rounds.

## 2. Retire the client-authored production path

- [ ] 2.1 Remove the old hand-entered companion panel from Arena-bound control-workbench sessions while preserving controller editing, preview and official submission workflows.
- [ ] 2.2 Delete or narrow the intervention generation route so Arena governed writes require a server-verified current-student, current-task official submission.
- [ ] 2.3 Resolve method-aware parameters, metrics and guidance from the official submission artifact plus the registered task and MetricProfile, rejecting mismatched client method hints.
- [ ] 2.4 Use the scoped official submission reference for deduplication and permit the next same-task official submission to close and, when eligible, start a new companion round.
- [ ] 2.5 Preserve legacy client-authored records without deleting or upgrading them, and ensure they do not affect official score, LearningFact, portrait, ranking or task completion.

## 3. Product and delivery verification

- [ ] 3.1 Add component and route coverage for no old panel, rejected forged observations, official advice card, feedback and same-task follow-up comparison.
- [ ] 3.2 Run Playwright on a supported Arena control workbench through official submission, companion expansion and follow-up at 1440px and 320px, including keyboard focus and no horizontal overflow.
- [ ] 3.3 Capture revision-bound Commercial UI Evidence from a clean runtime with source/runtime proof, manifest hashes and desktop/mobile screenshots.
- [ ] 3.4 Run focused unit/route/component tests, affected Playwright tests, `npm run typecheck`, `openspec validate retire-client-authored-companion-interventions --strict`, repository strict validation and `git diff --check` on the final intended revision.
- [ ] 3.5 Record verification results and the post-merge `openspec archive retire-client-authored-companion-interventions --yes` responsibility before delivery.
