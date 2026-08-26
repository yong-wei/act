## Context

The predecessor change `capture-modular-monolith-refactor-baseline` is the sole factual input. It closes the declared inventory denominators for routes, APIs, persistence, events, workers, scripts, tests, registries, OpenSpec capabilities, dependency edges, reverse edges, strongly connected components, compatibility surfaces, gates, and oversized change centers. It also preserves ambiguity instead of inferring ownership from directory names. This change turns those observations into a reviewed governance charter without changing runtime code.

The supplied refactor program calls for a modular monolith rather than microservices. The charter therefore has to make ownership and trusted boundaries explicit while preserving existing formal capability contracts. In particular, the charter must not duplicate or weaken `frontend-build-source-boundary`, `owned-surface-module-hygiene`, `server-action-and-route-safety`, `app-router-rendering-boundary-safety`, or `stable-dependency-chain-migration`.

## Goals / Non-Goals

**Goals:**

- Bind the charter to one qualified baseline identity (`sourceCommit`, `sourceTree`, schema version, and receipt set).
- Resolve every capability to one unique target owner and retain repository-relative evidence for the decision; qualification fails for a missing or multi-candidate owner.
- Define bounded contexts, allowed dependency directions, and the distinction between product, toolchain, data, and release surfaces.
- Explain every hard gate by threat, protected fact, failure consequence, and one authoritative validation location.
- Give every compatibility surface a named owner, known consumers, replacement, deletion condition, and follow-up change.
- Make the five human-readable documents deterministic projections of one charter record set.

**Non-Goals:**

- Moving, deleting, or re-exporting production modules in this change.
- Turning the charter into an active lint, CI, typecheck, or runtime gate.
- Reclassifying a baseline observation merely because it is large, imports Prisma, or currently fails a test.
- Claiming that all legacy code is migrated or that a future domain owner is already implemented.
- Creating GitHub Issues, claiming work, deploying, or activating production.

## Decisions

### 1. Treat the qualified baseline as an input contract

The implementation SHALL require the exact qualified baseline identity and reject missing, dirty, mixed-worktree, or denominator-incomplete input. The charter may retain competing evidence in a blocking adjudication record, but it SHALL NOT qualify that record or the charter until the ambiguity is resolved to exactly one target owner; it must not rewrite the baseline. A hand-maintained inventory without baseline identity was rejected because later changes could not prove which facts were used.

### 2. Use one owner catalog and one ownership matrix

The charter will use a stable domain catalog covering, at minimum, Assessment, Personalization, Learning Record, Course, Classroom, Assignment, Practice Lab, Arena, Knowledge/Resource governance, Identity/Authorization, and Platform/Delivery infrastructure. Each capability receives exactly one target owner. A record with no candidate owner or more than one candidate owner blocks qualification. A non-qualified draft may retain a blocking record with an accountable owner, competing evidence, and an explicit resolution condition, but that record is not a qualified exception and cannot satisfy the owner requirement. Route, API, model, event, worker, script, registry, and test records reference the unique owner and include current owner, evidence references, and a resolution state. Shared infrastructure is owned by its platform boundary rather than treated as an unowned common domain.

### 3. Derive all five documents from one normalized charter record set

The generator will write the five requested documents in stable order from one normalized input. The bounded-context map and dependency rules consume the same owner IDs; the trust-boundary matrix consumes the same gate IDs; and the deprecation ledger consumes the same compatibility IDs. Independently edited duplicate tables were rejected because they would drift.

### 4. Classify defenses by consequence

Each gate record contains `protectedBoundary`, `protectedFact`, `threat`, `failureConsequence`, `validator`, `consumers`, and `class`. `hard` is reserved for identity/privacy, authoritative scoring, persistence integrity, external-to-authority ingress, release activation, numerical safety, and equivalent consequences named by the supplied program. API/manifest/event/WASM normalization is `contract`; optional evidence and presentation enhancements are `soft`; duplicate internal checks and undated facades are candidates for removal. The charter records evidence and does not weaken an existing gate.

### 5. Make retirement explicit and monotonic

Every compatibility record receives a replacement owner, current consumers, deletion condition, planned follow-up change, and verification evidence. A record cannot be marked removable solely because its name looks old, and a new facade cannot be approved without a deletion condition. The ledger is the authority for later deletion work; this change does not delete the implementation.

### 6. Keep enforcement and migration in later changes

The charter is a decision and documentation boundary. `enforce-modular-domain-dependency-contracts` consumes it to implement fitness checks and a closed allowlist, while `decouple-teacher-diagnosis-route-contract` consumes that contract for the first complete vertical slice. This sequencing avoids turning an unreviewed ownership guess into a repository-wide build failure.

## Risks / Trade-offs

- [Risk] Baseline evidence becomes stale while the charter is reviewed. → Record the exact source identity and require a fresh dependent baseline when the source revision changes materially.
- [Risk] A unique owner hides a genuinely shared concern. → Require one accountable owner plus explicit consumer/dependency records; sharing is expressed through contracts, not multiple authorities.
- [Risk] A hard-gate matrix preserves redundant defenses. → Require the threat and sole validator fields and list duplicate checks as removable candidates for later review.
- [Risk] Human-readable projections drift from machine evidence. → Generate all five files from one normalized record set and validate cross-document IDs and counts.
- [Trade-off] Ownership adjudication may block a charter until evidence is reviewed. → Treat unresolved ownership as a qualification failure rather than silently creating a permanent exception.

## Migration Plan

1. Qualify and freeze the predecessor baseline identity.
2. Characterize current owners, boundaries, gates, and compatibility surfaces from the frozen inventories.
3. Review owner and gate decisions, then generate the five architecture documents.
4. Validate deterministic projections, cross-document references, unique ownership, and ledger completeness.
5. Hand the charter identity to the dependency-contract change. No application, database, CI, deployment, or production rollback is applicable because this change is governance-only.

## Open Questions

None for this proposal. Any unresolved or multi-candidate owner must remain an explicit blocking record with an accountable owner, evidence, and resolution condition; it must be resolved before the charter can be qualified and cannot be treated as a qualified exception.
