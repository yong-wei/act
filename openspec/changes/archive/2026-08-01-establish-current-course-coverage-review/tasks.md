## 1. Assemble the current worklist

- [x] 1.1 Read the admitted Aggregate and accepted Delta receipts, enumerate current reviewable membership and emit one provenance-bound row per Canonical object.
- [x] 1.2 Preserve historical decisions only as `priorDecisionRefs`, calculate current profile-only/evidence boundaries and reject missing or duplicate members.
- [x] 1.3 Emit a deterministic worklist input digest and assembly receipt bound to the Release, Delta and authoring revision.

## 2. Freeze deterministic review batches

- [x] 2.1 Implement stable semantic grouping and deterministic splitting with exact batch IDs, ordered members, member digests, evidence counts and reviewer policies.
- [x] 2.2 Verify that batch membership is disjoint, its union equals `N_current`, and profile-only/new/changed/high-risk members receive the required Challenger policy.
- [x] 2.3 Emit the machine-readable batch manifest used as the sole input for later `review-course-coverage-<batch-id>` Buddy proposals.

## 3. Enforce drift and authority boundaries

- [x] 3.1 Reject Aggregate, Delta, authoring or worklist drift before manifest publication and decision assembly.
- [x] 3.2 Prove that this change writes no current Coverage decision and changes no production selector or writer fence.

## 4. Verify review-input closure

- [x] 4.1 Add deterministic regeneration, denominator, duplicate, omission, evidence-boundary, batch-overlap and tamper tests.
- [x] 4.2 Run targeted tests, typecheck, strict OpenSpec validation and diff checks; publish worklist and batch-manifest receipt locations.
