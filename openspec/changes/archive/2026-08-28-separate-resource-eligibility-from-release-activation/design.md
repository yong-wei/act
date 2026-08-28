## Context

The current resource pipeline contains retrieval/citation readiness, ResourceNode path audits, formal Canonical bindings, source-owned launch metadata, full-resource path gates, Teaching Projection qualification, and per-consumer activation. `full-resource-path-readiness-gate.ts` and ResourceNode audits answer a planning question; `src/lib/teaching-projection/activation.ts` and `runtime-active-release.ts` answer a release/activation question. They must not be normalized into one boolean or one mutable status chain.

## Goals / Non-Goals

**Goals:**

- Make each readiness/eligibility/activation dimension visible and independently evidenced.
- Evaluate path selectability only for a stated user, role, course, purpose, stage, and revision context.
- Preserve strict formal resource and release gates while allowing local failure for ordinary optional surfaces.
- Provide one server-side read contract and a closed caller denominator without adding a second registry or activation writer.
- Make stale, retired, unauthorized, or mixed-capture inputs fail closed and prevent overclaiming.

**Non-Goals:**

- Replacing existing ResourceNode, binding, Teaching Projection, Runtime Release, or consumer activation schemas.
- Selecting or ranking a learner's next step, writing a selector, promoting a candidate, awarding completion/mastery, or emitting a LearningFact.
- Changing route behavior, Prisma schema, production deployment, release cutover, or historical/Legacy records.
- Making all optional resources mandatory or making every retrieval result path-eligible.

## Decisions

### 1. Represent a matrix of independent dimensions

The public result is a `ResourceEligibilitySnapshot` with a context identity and separate records for:

1. retrieval readiness (source/citation can be retrieved under the requested scope);
2. path eligibility (an audited ResourceNode/PlanningUnit may be considered in the stated planning context);
3. formal binding (an atomic Canonical teaching binding is valid under its capture and role contract);
4. launch availability (a current role-authorized source-owned launcher can consume the descriptor);
5. formal release qualification (the resource passes its release/package gate);
6. Teaching Projection activation (the exact projection is selected and active for its scope); and
7. consumer activation (the named consumer's immutable activation combination is ready).

Each dimension has its own status, evidence identities, and bounded reason. `eligibleForContext` is derived only for the requested purpose/stage and does not imply any later dimension. A missing later dimension cannot be hidden by a true earlier dimension. There is no aggregate `ready` value that stands for all seven meanings.

### 2. Use a context-bound server evaluator

`ResourceEligibilityContext` includes opaque user/role identity as permitted by the authorization boundary, course and scope identifiers, purpose (`browse`, `recommend`, `path`, `formal-bind`, `launch`, or a named consumer), stage, requested Authority/resource-index/revision identities, and the expected launcher contract. `evaluateResourceEligibility` consumes the generated RegistryIndex entry and existing evidence readers and returns a versioned snapshot plus a context hash. It performs no database or selector mutation.

User and role affect only the dimensions for which authorization is relevant; a teacher's visibility cannot make a student launchable, and a recommendation context cannot qualify a release. Course scope and stage are explicit so a resource eligible for a teacher preview is not silently eligible for a student's formal path.

### 3. Keep formal activation with existing owners

The evaluator may report the current result of `src/lib/teaching-projection/activation.ts`, `runtime-active-release.ts`, and the versioned consumer activation reader, but it cannot build or replace their pointers. Formal release qualification remains the existing immutable package/release gate. Teaching Projection activation remains the existing authorized transaction. Consumer activation remains per named consumer and exact Authority/Projection/resource identity.

`OPTIONAL` and `NONE` may explain why a resource is not selected for a non-formal context, but they do not satisfy atomic closure, formal binding, qualification, or activation. An engineering-only consumer may omit Teaching Projection only under its existing consumer contract; that exception must not be copied to teaching consumers.

### 4. Apply hard checks before local degradation

The evaluator first verifies RegistryIndex identity, source/hash/version/scope closure, retirement state, role authorization, course scope, requested revision, and launcher contract. A mismatch or missing required evidence returns a fail-closed dimension with a stable reason and never falls through to a prior or candidate revision. A resource may be retrievable while path-ineligible, formally bound while not launchable, or launchable in a teacher context while not qualified for release.

For ordinary browse, recommendation, or optional card/media blocks, the server may return `unavailable`/`degraded` for the affected entry and preserve unaffected base knowledge and engineering topology. This soft behavior is prohibited for a formal package, a required path node, or an activation transaction; those consumers remain blocked or pinned according to their existing contracts.

### 5. Keep evidence and learning semantics separate

An eligibility response is an observation for a caller. It must not write a selector, promote a candidate, create a PathNode, emit a completion or mastery claim, create a LearningFact, or infer learning from a launch/read. Existing assessment, event, evidence, and learning-record contracts remain the only writers for those facts.

### 6. Denominator and retirement are explicit

The implementation must freeze all producers, readers, routes, APIs, Prisma/model access sites, scripts, tests, generated artifacts, dynamic callers, and compatibility adapters for every old readiness chain and each new evaluator dimension. A ledger records owner, input/output identity, consumer, status, evidence, and deletion condition. R2 does not delete an old entrypoint; only R4 may do so after zero-caller and rollback proof.

## Migration and deletion evidence

Add the evaluator as a read-only adapter over the R1 index and existing contracts, then migrate one caller per context class. Compare old behavior to the dimensioned snapshot and preserve explicit soft failures. Remove an old aggregate status only when no classified caller consumes it and its replacement has revision-bound parity; record that candidate in the R4 ledger rather than leaving a facade.

## Verification

Test the seven-dimension matrix, user/role/course/purpose/stage context, source/index/revision drift, retirement and authorization failures, optional local degradation, formal hard blocks, `OPTIONAL`/`NONE` non-bypass, engineering-only projection exception, no-write behavior, and caller denominator reconciliation. Run the affected resource/path/knowledge/teaching-projection suites, typecheck, strict OpenSpec validation, and `git diff --check`.

## Risks / Trade-offs

- Consumers may still read one convenient aggregate flag. → Make the public type dimensioned and reject an evaluator result that omits a required dimension.
- Soft degradation may be applied to a formal path. → Bind degradation policy to purpose/stage and fail formal consumers closed.
- A stale optional descriptor could leak a prior launch target. → Recheck source/index/revision/role and omit the descriptor on mismatch.
- A read evaluator may grow into an activation service. → Make it side-effect-free and prohibit selector, release, learning, and evidence writes in contract tests.

## Migration Plan

1. Verify R1's RegistryIndex identity and freeze the complete seven-dimension producer/caller denominator.
2. Define the context, dimension result, reason, evidence, and policy contracts as a server-side public read boundary.
3. Implement adapters over existing ResourceNode, binding, Teaching Projection, Runtime Release, and consumer activation readers.
4. Migrate representative browse, recommendation, path, launch, and formal consumers; prove optional local degradation and formal fail-closed behavior.
5. Publish the dimension/caller ledger and hand deletion candidates to R4. Do not activate or deploy a selector from this change.

Rollback removes the evaluator caller adapters and returns to the existing source-owned readers; it does not modify their state, release pointers, learning records, or historical evidence.

## Open Questions

None blocking. The exact enum names may follow existing contract vocabulary, but the seven dimensions, context fields, independent evidence, and no-write boundary are mandatory.
