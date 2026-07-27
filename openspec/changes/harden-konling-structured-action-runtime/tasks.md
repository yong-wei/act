## 1. Provider normalization and persistence

- [ ] 1.1 Normalize native, block-based, and recognized DSML tool-call events into one internal stream contract.
- [ ] 1.2 Prevent raw structured-call syntax from entering assistant prose and add bounded same-turn correction for malformed calls.
- [ ] 1.3 Persist assistant-turn links to tool runs, structured outputs, idempotency identity, and terminal action state.
- [ ] 1.4 Restore structured action cards from persisted conversation records without rerunning completed tools.

## 2. Smart-preparation action cards

- [ ] 2.1 Render `propose_smart_lesson_task_change` results as in-message apply and ignore cards.
- [ ] 2.2 Apply accepted diffs through the authorized optimistic smart-task revision service and highlight affected accordion stages.
- [ ] 2.3 Handle stale-task conflicts, ignored state, duplicate actions, and action failures in place.
- [ ] 2.4 Remove the separate smart-preparation suggestion panel and correct `孔灵` plus affected English primary labels.
- [ ] 2.5 Preserve focused page tool sets and the existing project page-context injection.

## 3. Streaming and verification

- [ ] 3.1 Integrate tool-call correction with the shared provisional-message revision, `正在后台优化响应`, same-turn replacement, and p95 limit delivered by `integrate-konling-textbook-rag`, without creating another state machine.
- [ ] 3.2 Verify one readable proposal summary plus persistent success, ordinary failure, conflict, ignore, duplicate-action protection, and transient stage highlighting.
- [ ] 3.3 Test native and DSML tool calls, malformed markup, mixed text and tools, reload, idempotent apply, conflict, ignore, and no markup leakage.
- [ ] 3.4 Test one readable conversation across a page transition, maximized history, smart-preparation natural-language creation and revision, persisted action cards, and no repeated tool execution.
- [ ] 3.5 Preserve at least one real-model structured-action success and run typecheck, provider compatibility tests, Konling runtime tests, smart-preparation tests, and desktop plus mobile browser acceptance.
