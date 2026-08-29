## 1. Establish the trust boundary

- [x] 1.1 Inventory all Copilot request producers and distinguish page hints from learner profile fields.
- [x] 1.2 Define a server-owned, student-safe profile projection with explicit availability and limitation states.
- [x] 1.3 Add contract tests proving client identity, learning style, cognitive level, and ability values are untrusted.

## 2. Bind runtime context to governed state

- [x] 2.1 Update `/api/ai/chat` to resolve the current learner profile from authenticated, governed server state.
- [x] 2.2 Ensure client profile fields cannot alter prompt construction, session scope, or evidence ownership.
- [x] 2.3 Preserve generic course assistance when profile data is missing or unavailable, with explicit personalization limitations.

## 3. Verify the learner experience

- [x] 3.1 Add no-evidence, low-confidence/stale, unavailable, and valid-profile unit/API regressions.
- [x] 3.2 Add browser coverage for `/ai` and `/ai/copilot` proving the displayed state and next action are not fabricated personal facts.
- [x] 3.3 Verify that no chat path writes LearningFact, official score, ranking, or learner profile updates.

## 4. Delivery gates

- [x] 4.1 Run focused tests, affected domain tests, TypeScript checks, and `git diff --check`.
- [x] 4.2 Run `openspec validate bind-copilot-profile-to-governed-evidence --type change --strict`.
- [x] 4.3 Capture revision-bound desktop and 320px evidence for the affected Copilot states when implementation is complete.
