## Context

This change is a content-governance increment for system modeling, time-domain analysis and stability analysis. It consumes the incremental projection contract and must not change engineering facts or wait for exhaustive coverage.

## Goals / Non-Goals

**Goals:** publish reviewed core-node membership and evidence-backed direct teaching prerequisites for the three foundation domains.

**Non-Goals:** infer transitive edges, review unrelated domains, or change Authority entities and relations.

## Decisions

1. Start from current course objectives, primary teaching resources, existing reviewed cards and explicit teacher curation; Authority membership alone is not evidence of teaching order.
2. Store only direct REQUIRED or RECOMMENDED edges. Derived reachability and learning order remain runtime views.
3. Review unresolved candidates incrementally. Accepted edges publish even when other candidates remain uncovered, provided the candidate fragment is internally valid.
4. Bind every accepted record to the current Authority object, ACT evidence and fragment revision; unchanged records retain their prior evidence digest.
5. Publish an independent immutable fragment `foundation-three-domain-v1`. Do not rewrite the #1370 first fragment (`foundation-published-v1`) or its persisted authoring, published, or first-only composed-manifest bytes.
6. Fix the core denominator to the four nodes that still exist in the live Authority snapshot:
   - `ctc:modeling-00d2998755974a1329049aac` — system-modeling, 增益
   - `ctkg:v3e-canonical-312d1dfa7e96b9cc6f46e253` — time-domain-analysis, 单位阶跃响应
   - `ctkg:v3e-canonical-ec8dceb901656a3a0a32d12b` — stability-analysis, 稳定性
   - `ctc:v11g-1c9f955b68fd25e1f4ad86f6` — time-domain-analysis + stability-analysis, 调节时间
   Unselected Authority objects stay outside this increment's coverage denominator.
7. Publish exactly one direct REQUIRED `ACT_TEACHING` edge: 单位阶跃响应 → 调节时间. The pedagogical evidence is the 2-2 teaching mainline and objectives in `course-content/authoring/lessons/2-2/design/2-2-boppps.md`, which start from the unit-step response and define settling time.
8. Keep `增益 → 稳定性` and `稳定性 → 调节时间` as unresolved worklist candidates. Same-lesson co-occurrence in 1-5, or a three-domain evidence chain, is not a teaching-order decision. These candidates must not emit `ACT_TEACHING` edges and must not be replaced by Engineering predicates.
9. Authoring and published artifacts bind through the existing complete live Authority envelope helper and builder contract from #1370 (`liveAuthorityEnvelopeForFirstFragment` + `buildDomainTeachingFragment`). Endpoints resolve only from envelope nodes loaded from the live `engineering.json`; Authority facts are not fabricated. Additional authoring/capture claims must match that envelope. A two-fragment composed fixture, if present, is a validation artifact only and is not a runtime current pointer.
10. The two-fragment composition fixture does not compose or replace the published #1370 first-fragment.* artifacts. It deterministically rebuilds the #1370 teaching fragment from its retained authoring source against a shared canonical union Authority envelope solely for interoperability validation. The published #1370 artifacts remain byte-identical historical records with their original authority-selection digest.
11. The shared validation union is exactly the five retained #1370 endpoints plus the four-node #1371 denominator, deduplicated by `canonicalId`: eight unique live Authority nodes because stability is shared. The union uses one fixed binding, source dataset and capture/authoring revisions with deterministic identity ordering. The #1371 coverage denominator remains exactly the four selected nodes and is not expanded by the retained union members.
12. The validation fixture does not change Authority selection or persistence, runtime/store/pointer/activation paths, or the #1370 historical records. It exists only to prove that a derived first fragment and `foundation-three-domain-v1` preserve provenance and identity under the shared envelope.
13. Accepted remediation for current-head validation: the shared stability node in the new authoring and published fragment SHALL use the retained first fragment's `PREREQUISITE_ENDPOINT`, module and 3-1 rationale fields so validation-only composition cannot silently attribute the node to conflicting provenance. The #1371 four-node denominator and its 1-5 curation evidence remain explicit in the increment worklist and coverage artifact. This is a fixture/artifact correction only; the #1370 compose contract is unchanged.

## Risks / Trade-offs

- [Foundation scope grows without bound] → Limit the denominator to explicitly selected core nodes.
- [Reviewers encode topic proximity as prerequisite] → Require a direct pedagogical rationale for every edge.

## Migration Plan

Create domain worklists, review candidates, publish one validated fragment and retain the prior projection for rollback.
