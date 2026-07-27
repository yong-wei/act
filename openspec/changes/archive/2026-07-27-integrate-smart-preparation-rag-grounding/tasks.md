## 1. Retrieval consumer

- [x] 1.1 Bind implementation to the archived structured textbook, hybrid retrieval, reranking, citation, and reader contracts from the active RAG series.
- [x] 1.2 Add the smart-preparation resource-pack profile for authorized uploads and confirmed textbook structural ranges.
- [x] 1.3 Add default selection for enabled `可编辑` and `已冻结` uploads, non-selectable reasons for other states, and course/topic textbook recommendations with book, chapter, and section confirmation.
- [x] 1.4 Invoke first-use freeze atomically when uploaded content is accepted into the resource pack.

## 2. Source governance

- [x] 2.1 Add Chinese `备课资源包` help, compact source states, and expandable document, chapter, section, and snippet details.
- [x] 2.2 Add source matching for suggested and teacher-entered knowledge points and goals.
- [x] 2.3 Add ambiguity resolution and explicit no-source gap confirmation with a short reason.
- [x] 2.4 Invalidate source decisions after semantic edits while preserving them after formatting, whitespace, or punctuation-only edits.
- [x] 2.5 Read the current cumulative class portrait, default to the teacher's default class, and mark generated content stale when class selection changes.
- [x] 2.6 Add `已关联依据`, `需要确认来源`, and `无可靠来源` presentation for knowledge, goals, and generated content, including inspect, replace, and remove actions.
- [x] 2.7 Keep same-class portrait updates live and silent while providing a non-blocking governed reason when the default class has no cumulative portrait.

## 3. Verification

- [x] 3.1 Test authorization, upload defaults, textbook range bounds, retrieval budgets, reranking, citations, and first-use freeze.
- [x] 3.2 Test reliable automatic match without mandatory handling, inspect/replace/remove, ambiguous candidates, persistent no-source status, and semantic invalidation.
- [x] 3.3 Test current cumulative class portrait selection, unavailable default portrait, silent same-class updates, no-class mode, alternate class, and stale regeneration from the outline.
- [x] 3.4 After the preceding four smart-preparation changes and formal textbook RAG contracts are available, complete one continuous real-teacher E2E covering course-basis creation, task creation, selected textbook sections, an uploaded document, a real cumulative class portrait, real-provider full BOPPPS generation, injected failure recovery, editor save, AI suggestions, reopen, and deletion of an unpublished task.
- [x] 3.5 Preserve timestamped evidence for at least one complete real-model success and run typecheck, source-pack tests, smart-preparation tests, and desktop plus narrow-screen browser acceptance.
- [x] 3.6 Update `docs/ProjectDescription.md` with the verified commercial smart-preparation behavior and review the final documentation diff.
