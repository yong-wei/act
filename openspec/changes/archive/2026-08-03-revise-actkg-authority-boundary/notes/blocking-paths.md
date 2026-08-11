# Inventory: global-blocking paths (pre-boundary-fix)

Series root change: `revise-actkg-authority-boundary` (#1265).

This note inventories the **pre-fix** paths that coupled ActKG Engineering Authority
to ACT CourseCoverage / exhaustive Release denominators. Implementation replaces
these couplings with independent Authority / Teaching Projection / consumer states.

## Authority / snapshot readers

| Path | Blocking behavior before #1265 | Post-fix intent |
|------|--------------------------------|------------------|
| `src/lib/aggregate-governance/declared-authoritative-snapshot.ts` | Frozen #1117 receipt is permanently `ACCEPTED_CANDIDATE`; downstream CourseCoverage / teaching / formal consumers typed as `BLOCKED`. Snapshot treated as candidate-only evidence for production. | Snapshot remains immutable evidence. Explicit Engineering Authority activation MAY publish without CourseCoverage closure. Teaching consumers keep local dependency status. |
| `src/lib/aggregate-governance/latest-aggregate-authority.ts` | Integrity closure for lock/import/bundle/delta only (no teaching). | Keep integrity fail-closed; do not add CourseCoverage prerequisites. |
| `src/lib/authoritative-knowledge/repository.ts` | Candidate-state gates (`ACCEPTED_CANDIDATE`); CourseCoverage reader produces audit, not production cutover. | Preserve integrity; CourseCoverage never gates Engineering Authority activation. |

## CourseCoverage / worklist denominator

| Path | Blocking behavior before #1265 | Post-fix intent |
|------|--------------------------------|------------------|
| `src/lib/aggregate-governance/membership.ts` `selectCanonicalObjectMembership` | Requires non-empty Projection ≡ knowledge_object equality (full Release object set). Empty set rejects. | Historical Release membership remains for engineering identity. ACT teaching denominator is a separate, optionally empty ACT-bound scope. |
| `src/lib/aggregate-governance/current-course-coverage-review.ts` `buildCurrentCourseCoverageWorklist` | Builds worklist over full current membership; profile-only rows stay in denominator. | New ACT teaching-scope builders may be empty; unbound Aggregate/profile-only objects stay outside the ACT denominator and do not block Authority. |
| `src/lib/aggregate-governance/course-coverage.ts` `validateCourseCoverageAuthoring` | `requireExhaustive ?? mode === 'baseline'` forces every `currentCanonicalIds` entry to have a disposition. Callers often pass full Release membership. | Exhaustive checks apply only to the ACT teaching scope passed in; unprojected upstream objects are never required. |
| `src/lib/aggregate-governance/review-workflow.ts` (baseline overlay assembly) | `requireExhaustive: true` over full worklist items. | Historical batch tooling remains audit substrate; new selectors do not treat full-Release exhaustive closure as Authority gate. |
| `src/lib/aggregate-governance/pipeline.ts` | Baseline coverage uses `requireExhaustive: coverageMode === 'baseline'` over `input.currentCanonicalIds`. | ACT teaching coverage remains local; engineering packaging does not wait on global CourseCoverage. |
| `src/lib/aggregate-governance/current-course-coverage-batch-review.ts` | Terminal `DEFER` → `coverageAuthorityState: UNRESOLVED_BLOCKING`; batch `aggregateCoverageGate: BLOCKED_UNRESOLVED_EVIDENCE`. | Historical receipts freeze into immutable legacy audit; new selectors MUST NOT read DEFER as global Authority/consumer block. |

## Readiness / consumer selectors

| Path | Blocking behavior before #1265 | Post-fix intent |
|------|--------------------------------|------------------|
| `src/lib/aggregate-governance/readiness.ts` | KAQ readiness tied to CourseCoverage count; teaching/path/facts/cutover hard-blocked. | Engineering Authority readiness independent. Teaching consumers report local `NOT_PROJECTED` / `BLOCKED_LOCAL_DEPENDENCY` / `PINNED_PREVIOUS`. |
| `src/lib/authoritative-knowledge/course-coverage-admission.ts` | Projection of covered IDs only; never production authoritative. | Keep non-authoritative; historical DEFER never invents a global block. |
| `src/lib/canonical-resource-binding/authority.ts` | Inventory completeness over the provided inventory; always `authorityState: 'LEGACY'`. | Package-scoped gates: unresolved resource blocks only the affected consumer package. |
| `src/lib/canonical-kaq-binding/authority.ts` | Formal consumers always LEGACY; Engineering Authority alone must not cut over. | Preserve pin/fallback until local Teaching Projection + binding readiness pass. |

## Historical DEFER evidence (34 batches)

- Directories: `course-content/authoring/knowledge/issue-1190-course-coverage-review` … `issue-1223-course-coverage-review`
- 34 `batch-receipt.json` files; 4,891 ordered members; 11 `INCLUDE`, 4,880 `DEFER`
- Batch status: `DEFERRED_EVIDENCE_BLOCKED`; gate: `BLOCKED_UNRESOLVED_EVIDENCE`
- Frozen manifest: `course-content/authoring/knowledge/legacy-course-coverage-audit/legacy-audit-manifest.json`
- Reader: `src/lib/aggregate-governance/legacy-course-coverage-audit.ts` (audit counts/provenance only)

## Decision table module

`src/lib/aggregate-governance/authority-boundary-gate.ts` encodes the fail-closed matrix:

1. Integrity-valid Bundle + empty teaching → Authority may become `ACTIVE`; teaching `NOT_PROJECTED`
2. Integrity failure → Authority `REJECTED_INTEGRITY`; dependent consumers blocked
3. Historical DEFER → no Authority or selector block
4. Unresolved local binding → only affected consumer `BLOCKED_LOCAL_DEPENDENCY`
