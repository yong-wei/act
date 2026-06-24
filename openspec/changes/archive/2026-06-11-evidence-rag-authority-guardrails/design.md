## Context

Current corpus chunks preserve source type, source ref, privacy class, confidence, freshness, retrieval tags, and citation verification. Ranking is primarily confidence plus freshness. The close-loop design needs stricter authority and scope controls so generated assistant output is defensible.

## Goals / Non-Goals

**Goals:**

- Add explicit authority levels and retrieval scope rules.
- Enforce citation adequacy per use case.
- Provide a uniform citation rendering contract.
- Downgrade, redact, or block unsupported generated claims.

**Non-Goals:**

- Building a full new search engine.
- Exposing private learner evidence in ordinary student views.
- Using model confidence as a substitute for citation verification.

## Decisions

### Decision 1: Knowledge and evidence are different retrieval families

Course content, terminology, handouts, and knowledge cards are teaching knowledge. Learner state, grading, path, simulation, Arena, and teacher report chunks are learner evidence. Answers that explain course concepts need high-authority knowledge citations; personalized recommendations need both knowledge and learner-evidence citations where available.

### Decision 2: Authority participates in ranking and gating

Authority level is not a decorative label. It affects ranking and determines whether an answer can be displayed as authoritative, downgraded as tentative, or blocked.

### Decision 3: CitationChip is the UI boundary

Surfaces should not hand-roll citation display. A shared contract should expose title, href, source type, authority, freshness, privacy scope, confidence, and limitation state.

### Decision 4: Conflicts are visible

When high-authority sources conflict or learner evidence contradicts a personalized claim, the response should expose a conflict limitation instead of hiding the inconsistency.

## Validation

- Corpus validation rejects missing authority, invalid scope rules, and incompatible use-case/source combinations.
- Retrieval tests prove authority affects ranking and privacy still filters restricted chunks.
- Guardrail tests reject unsupported claims, fake citations, inaccessible sources, and citation/source-type mismatches.
- UI contract tests verify CitationChip receives enough metadata to render scope and limitation state.
- `rtk openspec validate evidence-rag-authority-guardrails --strict` passes.
