## 1. Retrieval consumer

- [ ] 1.1 Bind implementation to the archived structured textbook, hybrid retrieval, reranking, citation, and reader contracts from the active RAG series.
- [ ] 1.2 Add the smart-preparation resource-pack profile for authorized uploads and confirmed textbook structural ranges.
- [ ] 1.3 Add default selection for enabled `可编辑` and `已冻结` uploads, non-selectable reasons for other states, and course/topic textbook recommendations with book, chapter, and section confirmation.
- [ ] 1.4 Invoke first-use freeze atomically when uploaded content is accepted into the resource pack.

## 2. Source governance

- [ ] 2.1 Add Chinese `备课资源包` help, compact source states, and expandable document, chapter, section, and snippet details.
- [ ] 2.2 Add source matching for suggested and teacher-entered knowledge points and goals.
- [ ] 2.3 Add ambiguity resolution and explicit no-source gap confirmation with a short reason.
- [ ] 2.4 Invalidate source decisions after semantic edits while preserving them after formatting, whitespace, or punctuation-only edits.
- [ ] 2.5 Read the current cumulative class portrait, default to the teacher's default class, and mark generated content stale when class selection changes.
- [ ] 2.6 Add `已关联依据`, `需要确认来源`, and `无可靠来源` presentation for knowledge, goals, and generated content, including inspect, replace, and remove actions.
- [ ] 2.7 Keep same-class portrait updates live and silent while providing a non-blocking governed reason when the default class has no cumulative portrait.

## 3. Verification

- [ ] 3.1 Test authorization, upload defaults, textbook range bounds, retrieval budgets, reranking, citations, and first-use freeze.
- [ ] 3.2 Test reliable automatic match without mandatory handling, inspect/replace/remove, ambiguous candidates, persistent no-source status, and semantic invalidation.
- [ ] 3.3 Test current cumulative class portrait selection, unavailable default portrait, silent same-class updates, no-class mode, alternate class, and stale regeneration from the outline.
- [ ] 3.4 After the preceding four smart-preparation changes and formal textbook RAG contracts are available, complete one continuous real-teacher E2E covering course-basis creation, task creation, selected textbook sections, an uploaded document, a real cumulative class portrait, real-provider full BOPPPS generation, injected failure recovery, editor save, AI suggestions, reopen, and deletion of an unpublished task.
- [ ] 3.5 Preserve timestamped evidence for at least one complete real-model success and run typecheck, source-pack tests, smart-preparation tests, and desktop plus narrow-screen browser acceptance.
- [ ] 3.6 Update `docs/ProjectDescription.md` with the verified commercial smart-preparation behavior and review the final documentation diff.
