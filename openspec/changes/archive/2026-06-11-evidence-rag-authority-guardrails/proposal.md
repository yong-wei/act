## Why

The platform already has a governed learning-evidence RAG corpus and citation verifier, but retrieval ranking and answer gating are still too weak for a high-stakes teaching assistant loop. The assistant must distinguish authoritative course knowledge from learner evidence, preserve privacy, and downgrade or block unsupported claims.

## What Changes

- Add authority metadata to corpus chunks, including authority level, knowledge tags, page anchors, freshness bucket, and scope rules.
- Separate teaching knowledge retrieval from learner evidence retrieval while allowing controlled mixed retrieval.
- Add guarded answer verification that rejects fake, inaccessible, low-authority, or conflicting citations before display or persistence.
- Define a shared CitationChip contract for student, teacher, grading, diagnosis, Konling, and prep-pack surfaces.

## Capabilities

### Modified Capabilities

- `learning-evidence-rag-corpus`
- `konling-agent-runtime`
- `document-rubric-grading-workbench`
- `role-based-learning-diagnosis`

## Impact

- Extends corpus metadata and retrieval/ranking behavior.
- Affects AI answers, grading rationales, diagnosis explanations, recommendations, teacher reports, and prep packs.
- Does not implement vector database infrastructure unless existing retrieval cannot satisfy the guarded contract.
