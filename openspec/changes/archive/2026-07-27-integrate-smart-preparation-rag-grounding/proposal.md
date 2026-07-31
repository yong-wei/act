## Why

Smart preparation currently cannot give teachers a dependable, editable resource basis across platform textbooks and uploaded documents. The active textbook RAG series already defines the retrieval foundation; smart preparation should consume that contract and add teacher-facing source governance instead of building a parallel retrieval stack.

## What Changes

- Introduce the user-facing `备课资源包` concept while retaining `Source Pack` as the internal contract.
- Select all enabled usable uploaded documents in `可编辑` or `已冻结` state by default, exclude processing, failed, rejected, and disabled versions, and recommend platform textbooks according to course and topic for teacher confirmation.
- Let teachers choose platform textbook ranges by book, chapter, and section.
- Send uploaded documents and selected textbook ranges through the active hybrid retrieval and reranking contract.
- Show `已关联依据`, `需要确认来源`, and `无可靠来源` with expandable document, chapter, section, and cited snippet details and teacher replacement or removal.
- Automatically match sources for teacher-entered knowledge points and goals; ask the teacher only when matches are ambiguous or absent.
- Require explicit confirmation and a short reason for a reliable-source gap before that stage can complete.
- Re-run source matching after semantic edits, but ignore formatting-only, whitespace-only, and punctuation-only changes.
- Keep generation grounded in retrieved evidence rather than loading complete textbooks into the model context.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `source-pack-retrieval`: adds the smart-preparation consumer profile, teacher-owned upload scope, selected textbook range scope, and teacher-facing source projection.
- `smart-lesson-plan-authoring`: adds resource-pack selection, source matching, ambiguity resolution, and explicit source-gap completion gates.
- `teacher-course-basis-management`: connects first-use document freeze to actual resource-pack adoption.

## Impact

- Affects smart-preparation source selection, textbook navigation, retrieval requests, source matching, citation projections, and stage validity.
- Depends on the active textbook RAG contract becoming stable and on `govern-course-basis-document-lifecycle` exposing first-use freeze.
- Does not implement a second vector store, reranker, textbook exporter, or reader.
