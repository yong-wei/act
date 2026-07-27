## Context

The active textbook RAG series is establishing structured textbook runtime, hybrid retrieval, reranking, citation display, and a unified reader. Smart preparation needs a consumer contract for those outputs plus teacher-owned uploaded documents and source-gap governance.

## Goals / Non-Goals

**Goals:**

- Ground preparation in selected textbook ranges and uploaded sources.
- Keep source selection and gaps understandable to teachers.
- Reuse the active retrieval infrastructure and course-basis first-use freeze.

**Non-Goals:**

- Create another vector database, embedding pipeline, reranker, or textbook reader.
- Require every teacher-authored statement to have a fabricated citation.

## Decisions

### 1. Build a preparation retrieval profile

The internal Source Pack request combines authorized uploaded-document projections and explicitly selected platform textbook ranges. Retrieval remains lexical plus vector candidate generation followed by the external reranker defined by the RAG series.

### 2. Separate defaulting from confirmation

Enabled uploaded documents enter the initial selection automatically. Platform textbooks are recommended from course and topic but require teacher confirmation at book, chapter, or section granularity.

### 3. Match sources server-side

Knowledge points and goals receive source candidates and confidence. A unique reliable match is attached automatically; ambiguous matches are presented for teacher choice. No reliable match produces a gap that requires teacher confirmation and a short reason.

### 4. Invalidate only on semantic change

The server normalizes formatting, whitespace, and punctuation before comparing source-match identity. Semantic edits clear or re-evaluate affected bindings; display-only edits do not.

### 5. Freeze uploaded content on adoption

The same transaction that accepts an uploaded-document snippet into the resource pack invokes the course-basis first-use freeze contract.

## Risks / Trade-offs

- [RAG contracts change while this consumer is built] → Block implementation on the relevant archived RAG specifications.
- [Automatic match is confidently wrong] → Show the source and allow teacher replacement before confirmation.
- [Resource packs become too large] → Apply the RAG series budgets; never inject complete textbooks.

## Migration Plan

Keep existing source bindings readable. Build new resource packs only through the formal consumer profile. No legacy parallel mapping is retained after cutover.

## Open Questions

None.
