## Overview

Resource retrieval should extend the existing governed corpus. The retrieval layer should first enforce role, course, class, owner, and privacy scope, then combine lexical and semantic matching with knowledge/capability metadata.

## Retrieval Pipeline

```text
scope and policy filter
  -> full-text / keyword search
  -> vector search when available
  -> knowledge node and capability target filter
  -> authority and freshness ranking
  -> learner-context reranking
  -> citation candidate verification
```

## Indexed Resources

The projection should support Markdown handouts, knowledge cards, runtime handouts, video/audio transcripts with timestamps, image descriptions, exercises, simulations, Arena summaries, and teacher-reviewed explanations.

## Risks

- Vector-only retrieval will miss formulas, terms, and exact exercise references.
- Duplicating the existing corpus would split privacy and citation verification semantics.
- Learner evidence must remain optional for concept explanations and required for personalized claims.
