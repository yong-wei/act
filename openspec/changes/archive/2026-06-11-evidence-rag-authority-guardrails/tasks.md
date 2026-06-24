## 1. Corpus Metadata

- [x] 1.1 Extend corpus chunk metadata with authority level, knowledge tags, page anchors, freshness bucket, and scope rules.
- [x] 1.2 Update corpus validation to reject missing or incompatible authority metadata.
- [x] 1.3 Update chunk builders for course content, knowledge cards, runtime handouts, path summaries, diagnosis, grading artifacts, simulation, Arena, and teacher reports.

## 2. Retrieval and Guardrails

- [x] 2.1 Update ranking to consider authority, confidence, freshness, scope, use case, and query match.
- [x] 2.2 Add guarded answer verification for diagnosis, grading, Konling, recommendation, teacher report, and prep-pack use cases.
- [x] 2.3 Add limitation states for insufficient authority, missing learner evidence, conflicting sources, and privacy redaction.
- [x] 2.4 Ensure generated output is rejected, downgraded, or redacted before display or persistence when citations fail.

## 3. Citation UI Contract

- [x] 3.1 Define a shared CitationChip payload contract.
- [x] 3.2 Integrate CitationChip metadata into representative diagnosis, grading, Konling, and prep-pack payloads.
- [x] 3.3 Add tests that student views never receive private learner text or teacher-only scope details.

## 4. Verification

- [x] 4.1 Add corpus metadata and retrieval ranking tests.
- [x] 4.2 Add citation guardrail tests for fake, inaccessible, low-authority, and conflicting citations.
- [x] 4.3 Run `rtk openspec validate evidence-rag-authority-guardrails --strict`.
