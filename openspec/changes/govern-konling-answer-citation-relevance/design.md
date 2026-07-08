## Context

Konling currently builds answer citations by loading all textbook runtime search documents, adapting them into Source Pack items, and ranking them under the `konling-answer` profile. The profile filters by visibility, review status, AI-use permission, answer leakage, and citation readiness, but it does not enforce a minimum relationship between the selected evidence and the user's current question or server-owned knowledge workspace context.

This allows canonical textbook chunks with broad graph bindings and high authority scores to appear as high-confidence citations even when their actual text is unrelated to the question. The observed case is the knowledge graph assistant repeatedly citing `ADVANCED PROBLEMS` and `DESIGN PROBLEMS` chunks from `dorf-modern-control-systems`, including `ch01-advanced-problems-031__chunk-001`, for unrelated prompts.

## Goals / Non-Goals

**Goals:**

- Make `konling-answer` retrieval reject answer-evidence use of items that do not satisfy an answer-relevance contract.
- Require selected answer citations to carry auditable answer-relevance evidence.
- Preserve legitimate exact technical matches, selected-node matches, capability-target matches, and SAR candidate matches.
- Surface missing or downgraded citation context through Source Pack limitations and Konling citation metadata.
- Add regression tests for the fixed leakage chunks and the no-relevant-citation path.

**Non-Goals:**

- Do not complete the large textbook search-document review backlog in this change.
- Do not rewrite the knowledge graph page, citation chip UI, or model provider response handling.
- Do not introduce a vector database or external reranker as a hard dependency.
- Do not change path-planning resource eligibility.

## Decisions

1. Add a profile-specific relevance gate after policy filtering and ranking.

   The existing ranking combines exact, lexical, graph, authority, freshness, learner-context, eligibility, and optional semantic scores. For `konling-answer`, selection must additionally satisfy at least one strong relevance path: exact/lexical match to the question, explicit selected graph-node match, capability-target match, requested resource match, explicit SAR or learner candidate ref match, or sufficiently high semantic score when semantic scoring is available.

   Alternative considered: globally lower textbook authority scores. That would reduce the observed symptom but would also weaken valid textbook citations across authoring and path-planning profiles.

2. Treat high authority as support, not proof of answer relevance.

   Authority and review state remain useful tie-breakers once an item is relevant. They must not allow a candidate with no question or context match to become a high-confidence answer citation.

   Alternative considered: hide the citation in the knowledge graph UI. That would leave the answer prompt grounded in the wrong content and only mask the visible evidence.

3. Require relevance audit metadata for every selected answer citation.

   Each item selected as answer evidence must expose an `answerRelevance`-equivalent audit record in Source Pack output or downstream Konling metadata. The record must state that the relevance gate passed and identify the basis, such as `query-exact`, `query-lexical`, `selected-node-ref`, `capability-target-ref`, `resource-ref`, `sar-candidate-ref`, `learner-context-ref`, or `semantic-score`. It should also preserve a query hash and bounded context summaries needed for tests or administrator/debug audit without exposing raw private context to students.

   Alternative considered: rely on final score and limitation codes only. That is too weak because the current failure occurs when high authority and broad graph refs make a candidate look plausible without proving relevance to the current answer.

4. Keep the no-relevant-citation path explicit and non-grounding.

   When no selected item passes the answer-relevance gate, Source Pack must return no high-confidence answer evidence for content citations and must include limitation codes such as `answer-citation-insufficient-relevance`. Limited diagnostic items may exist for audit, but they must not be passed into answer generation, citation verification, or student-visible citation chips as high-confidence content citations. Konling citation context must carry the limited state so readiness and citation guard tests can assert the degraded state.

   Alternative considered: fall back to generic graph guidance without limitations. That would be less noisy but would make the failure invisible to tests and future audits.

5. Separate internal diagnostics from student-visible language.

   Raw limitation codes, ranking signals, query hashes, selected node ids, and SAR refs belong in service-side metadata, admin/debug evidence, or test assertions. Student-visible text and citation chips should use product language such as “当前问题没有找到可核验课程引用” and must not leak raw internal reason codes.

   Alternative considered: expose all reason codes in citation chips for debugging. That would recreate the engineering-semantic leakage problem in a student-facing surface.

6. Make runtime tests deterministic with fixture candidates.

   Unit tests should create Source Pack items that reproduce the current failure shape: high authority, canonical review, broad graph refs, citation-ready, but no query match. The known `ADVANCED PROBLEMS` ids should be present in at least one regression test so the original issue remains recognizable.

## Risks / Trade-offs

- [Risk] A strict lexical gate could reject valid Chinese paraphrases or formula-heavy questions. → Mitigation: allow selected-node, capability-target, SAR candidate, and future semantic scores as alternative relevance paths.
- [Risk] Missing citation states may make some answers look less confident. → Mitigation: this is the correct product behavior; the answer can still provide route-level guidance but must not claim unrelated high-confidence sources or use unrelated chunks as generation grounding.
- [Risk] Changing Source Pack selection can affect non-knowledge Konling surfaces. → Mitigation: scope the hard relevance gate to `konling-answer`; keep authoring, assessment, lesson-design, and path-planning profile behavior unchanged.
