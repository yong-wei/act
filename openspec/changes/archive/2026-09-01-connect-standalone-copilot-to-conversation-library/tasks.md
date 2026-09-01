## 1. Conversation identity and recovery

- [x] 1.1 Add failing client tests proving `/ai/copilot` creates or selects an owned conversation before sending and includes the verified `conversationId` in `/api/ai/chat` requests.
- [x] 1.2 Integrate the existing Konling conversation library with the standalone page without introducing a second persistence store.
- [x] 1.3 Hydrate only student-visible user and assistant messages when selecting, refreshing or reopening a conversation, and prevent stale loads from replacing a newer selection.
- [x] 1.4 Preserve explicit loading, empty, unauthenticated and recovery-failure states with retry or sign-in actions.

## 2. Governed lifecycle and task context

- [x] 2.1 Replace local-only message clearing with real new-conversation and confirmed-delete actions backed by the existing sessions API.
- [x] 2.2 Preserve server-owned portfolio-reflection and Evidence Copilot task contracts when a persisted conversation continues across pages or entry contexts.
- [x] 2.3 Add route and client regressions for owner isolation, forged conversation ids, current task-context revalidation, duplicate message prevention and stream/switch races.
- [x] 2.4 Prove reading, continuing or deleting a conversation does not create LearningFact, learner portrait, grade, ranking or formal reflection records.

## 3. Product verification

- [x] 3.1 Add Playwright coverage for create, send, refresh/reopen, select, new and delete flows on `/ai/copilot` at 1440px and 320px.
- [x] 3.2 Verify keyboard focus, loading/error announcements, composer reachability and no horizontal overflow for the conversation navigation and active chat.
- [x] 3.3 Capture revision-bound Commercial UI Evidence from a clean runtime with source/runtime proof, manifest hashes and desktop/mobile screenshots.
- [x] 3.4 Run focused client/route tests, affected Playwright tests, `npm run typecheck`, `openspec validate connect-standalone-copilot-to-conversation-library --strict`, repository strict validation and `git diff --check` on the final intended revision.
- [x] 3.5 Record verification results and the post-merge `openspec archive connect-standalone-copilot-to-conversation-library --yes` responsibility before delivery.

### Verification

- `npx vitest run src/lib/__tests__/standalone-copilot-conversation.test.ts src/lib/__tests__/ai-task-boundary-ui-source.test.ts src/app/__tests__/ai-chat-route-runtime-guard.test.ts src/lib/__tests__/konling-conversation-library-ui.test.ts src/lib/__tests__/governed-copilot-profile-context.test.ts` — 44 passed
- `PLAYWRIGHT_PORT=3218 npx playwright test tests/standalone-copilot-conversation-1758.spec.ts tests/governed-copilot-profile.spec.ts tests/evidence-copilot-grounding.spec.ts --workers=1` — 9 passed
- Commercial UI evidence: `artifacts/commercial-ui/issue-1758-standalone-copilot-conversation/`
- `npm run typecheck` — exit 0
- `git diff --check` — clean
- Archive is part of this PR delivery unit, not a post-merge follow-up.
