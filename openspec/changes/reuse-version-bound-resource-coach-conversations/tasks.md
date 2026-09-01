## 1. Reproduce the session creation race

- [ ] 1.1 Add failing client tests with a delayed conversation list proving resource-coach entry currently calls create before hydration completes.
- [ ] 1.2 Add refresh/reopen regressions proving the same version-bound unit creates repeated empty conversations and fails to restore a prior matching conversation.
- [ ] 1.3 Add exact identity fixtures for same unit/version, different revision, different content hash, different anchor and different owner.

## 2. Server-owned binding lookup

- [ ] 2.1 Add a bounded student-safe server projection or lookup for persisted resource-coach bindings without exposing raw messages or private mode context.
- [ ] 2.2 Revalidate current actor access and the complete resource identity before returning a matching conversation.
- [ ] 2.3 Add route/runtime tests for exact match, no match, version unavailable, forged identity, cross-user isolation and concurrent lookup.

## 3. Hydrate before create

- [ ] 3.1 Add explicit resource-coach resolution states and block automatic creation while list or binding hydration is pending.
- [ ] 3.2 Select and restore an exact matching conversation when available, preserving visible messages and pinned resource identity.
- [ ] 3.3 Keep a no-match entry as an unpersisted blank state and create/bind the conversation only on the first intentional question.
- [ ] 3.4 Make first-turn creation idempotent and ensure failures do not leave a visible unbound empty conversation.
- [ ] 3.5 Ignore stale lookup or create completions after the requested resource identity or selected conversation changes.

## 4. Product and delivery verification

- [ ] 4.1 Add Playwright coverage for open, first question, refresh/reopen, exact restoration and version change at 1440px and 320px.
- [ ] 4.2 Verify no additional conversation row is created by mount, panel open, refresh or repeated hydration without a submitted question.
- [ ] 4.3 Run focused sidebar/hook/session/runtime tests, affected Playwright tests, `npm run typecheck`, `openspec validate reuse-version-bound-resource-coach-conversations --strict`, repository strict validation and `git diff --check`.
- [ ] 4.4 Capture revision-bound Commercial UI Evidence when the visible resource-coach conversation state changes.
- [ ] 4.5 Record verification results and the post-merge `openspec archive reuse-version-bound-resource-coach-conversations --yes` responsibility before delivery.
