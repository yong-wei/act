## Context

The supplied refactor program was written against `integration@e74fd1fc65257349afa6a8e0ff1d1f8fac31f312`. The proposal investigation refreshed the measurements on `integration@dd5be47fad96d9b3e1bd1b56115d94a6c4358713` and found that the overall diagnosis remains valid while several details need stronger qualification:

- `tsconfig.json` still includes repository-wide `**/*.ts` and `**/*.tsx`. A cold `tsc --incremental false` completed in 37.85 seconds with 5,874,728,960 bytes maximum RSS and a 6,179,468,032-byte peak footprint.
- The repository tracks 3,251 TypeScript/TSX files under `src` and 890 tracked test files in the inspected source/test roots. The current Vitest config discovers tests through a manually maintained directory list.
- `npm run test:unit` reported 37 failing files, 93 failing tests, and three unhandled errors while 783 files and 9,792 tests passed. This is a mixed baseline, not evidence that every failure is historical or acceptable.
- `npm test` passed its smart-courseware, smoke, and Arena checks but failed the commercial UI governance step because two revision-bound evidence packages were stale or incomplete. The default command is therefore neither complete nor green.
- Sixteen feature files import `@/app`; only two are non-test production files, while the remainder are route/component tests. The baseline must distinguish product dependency inversion from tests that deliberately exercise route handlers.
- 135 files under `src/lib` and 427 files across `src` directly import Prisma types or the shared Prisma client boundary. Those counts describe coupling observations, not proof that every import is architecturally wrong.
- There are 33 TypeScript, TSX, or Rust files over 100 KB. The principal production change centers include `content-renderers.tsx` (269,754 bytes), `adaptive-learning-path-planner.ts` (241,939 bytes), and Rust `control-engine/src/lib.rs` (237,640 bytes). The earlier 800 KB Rust estimate is not current.
- General CI still runs only on `main` pushes and manual dispatch. A separate Wolfram workflow runs on pull requests to `integration`; it is not a general repository quality gate.

The baseline change must preserve those distinctions. Its output is evidence for later decisions, not the charter itself and not a justification to reorganize code by file size.

## Goals / Non-Goals

**Goals:**

- Produce a deterministic architecture census from one clean, committed `integration` revision.
- Close denominators for product entrypoints, domain candidates, persistence access, event contracts, workers, scripts, tests, registries, dependency edges, reverse dependencies, cross-domain deep imports, strongly connected components, compatibility surfaces, validation gates, and major change centers.
- Record current ownership, candidate target ownership, ambiguity, trust-boundary role, and evidence without silently resolving disputed ownership.
- Capture reproducible test, typecheck, CI, dependency, size, and import observations with their exact scope and environment.
- Give later changes stable ids and machine-readable inputs for monotonic boundary, quality, and deprecation checks.

**Non-Goals:**

- Defining the final bounded-context charter or deciding every ambiguous owner.
- Changing application behavior, import rules, TypeScript configuration, test selection, CI workflows, package layout, Prisma access, or runtime deployment.
- Creating npm workspaces, moving directories, splitting services, or deleting compatibility code.
- Querying production databases, runtime selectors, OSS, GitHub settings, learner data, or remote services.
- Treating a large file, a Prisma import, a failed test, or a directory name as sufficient evidence of a boundary defect.

## Decisions

### 1. Capture a clean source revision before committing generated evidence

The implementation will first land the census schema, generator, and tests as a coherent checkpoint. The baseline will then be generated from that clean commit and committed separately. The baseline records the source commit and tree it inspected; the later artifact commit is repository history, not a field that must be predicted by the generator.

This avoids dirty-worktree capture and the circular requirement for an artifact to contain the hash of the commit that contains the artifact. Capturing staged files, `git write-tree` snapshots, or mixed worktrees was rejected because later changes need a normal Git revision that every collaborator can reproduce.

### 2. Use one normalized observation schema with denominator manifests

The machine-readable baseline will contain:

- `schemaVersion` and capture identity (`sourceCommit`, `sourceTree`, commit time, Node/npm/TypeScript/Rust tool versions relevant to measurements);
- discovery manifests for each inventory kind and the include/exclude rules used to create its denominator, including the complete declared source-file dependency graph and its strongly connected components;
- stable observations keyed by kind and repository-relative identity;
- current owner, candidate target owner, resolution state, evidence references, trust class, and compatibility/deprecation flags where applicable;
- command summaries with exit status, aggregate counts, and bounded failure fingerprints;
- reconciliation totals that prove every discovered item is represented exactly once in its primary inventory.

Raw logs, source copies, media, generated HTML, screenshots, and database payloads will not be committed. Human-readable summaries and matrices are projections of the normalized baseline rather than separately maintained facts.

Separate bespoke spreadsheets were rejected because they would quickly diverge and could not support later architecture fitness checks.

### 3. Distinguish observations from adjudicated architecture decisions

Each ownership record uses one of `resolved-current`, `candidate-target`, or `ambiguous`. `ambiguous` is a valid baseline result and must carry the conflicting evidence. The follow-up charter change owns adjudication and cannot erase the baseline ambiguity without recording a decision.

Similarly, import counts are separated by production, test, generated, compatibility, and framework-convention surfaces. File-size observations carry reasons-to-change evidence where available. A test failure is recorded with the command and fingerprint but is not labeled implementation debt, stale test, or quarantine candidate until the quality-control series adjudicates it.

Automatically choosing the nearest directory as owner was rejected because the refactor exists precisely because directory location and semantic ownership have drifted apart.

### 4. Inventory trust gates by consequence, not by name

Every discovered blocking gate is recorded with its validator location, protected boundary, protected fact, threat or corruption mode, failure consequence, and current consumers. The baseline may mark the classification as unresolved; it does not weaken, relocate, or delete a gate.

Readiness-like fields are inventoried as distinct observations until a later change proves they represent the same business fact. This prevents the baseline from collapsing release authority, recommendation confidence, and UI availability into one state model.

### 5. Separate deterministic census facts from frozen measurement receipts

The source-derived census core contains repository-relative paths, stable ordering, and no wall-clock or runtime measurement fields. It must be byte-identical when regenerated from the same source revision with the same supported parser/tool contract.

Commands that measure duration, peak memory, or test execution create separate immutable measurement receipts. A receipt records its source revision, command and scope, platform and tool versions, declared cache mode, captured time, exit status, aggregate result, and bounded fingerprints. Baseline projections consume a fixed set of receipt identities; they do not silently rerun or replace those measurements. Re-projecting the same census core and the same frozen receipts must be byte-identical, while a new measurement creates a new receipt identity.

This keeps environment-sensitive evidence without requiring two executions to produce identical timing or memory values. Those measurements remain observations and are not universal pass/fail budgets in this change.

The generator fails on a dirty source worktree, missing capture identity, duplicate stable ids, denominator mismatch, unsupported schema version, or privacy/path violations. It does not fail merely because the architecture contains ambiguity or debt; those are the facts being captured.

### 6. Preserve existing specifications as domain evidence

The census indexes current and active OpenSpec capabilities and maps them to candidate owners. It does not consolidate, rename, or archive capabilities. Existing specifications such as `arena-module-boundary`, `frontend-build-source-boundary`, `release-signal-noise-governance`, and the Authority/Teaching Projection/runtime release contracts remain authoritative within their scopes.

## Risks / Trade-offs

- [Risk] Static discovery misses dynamic registry, framework-convention entrypoints, or dependency edges. → Combine filesystem, AST/import graph, configuration, route convention, registry, package-script, Prisma, and OpenSpec discovery; require explicit, tested exclusions, reverse-edge reconciliation, and strongly connected component coverage.
- [Risk] The artifact becomes a large run-specific evidence dump. → Commit only normalized observations, bounded fingerprints, and projections; exclude logs, screenshots, raw content, and repeated source text.
- [Risk] A baseline becomes stale immediately. → Bind it to one source revision and make later recapture explicit; never present it as live state without comparing the current revision.
- [Risk] Ambiguity is mistaken for permission to defer ownership forever. → Require the dependent charter change to close every target-owner ambiguity or create an explicit, owned exception with a removal condition.
- [Risk] Machine-specific memory and timing either break deterministic regeneration or are treated as universal budgets. → Store them in immutable measurement receipts, project only a fixed receipt set, and reserve budget enforcement for the engineering control-plane series.
- [Trade-off] A two-commit implementation checkpoint adds process overhead. → It provides a reproducible clean source revision and avoids unverifiable dirty capture.

## Migration Plan

1. Add and test the census-core schema, measurement-receipt schema, discovery adapters, dependency graph/SCC analysis, deterministic projector, privacy checks, and denominator reconciliation.
2. Commit that implementation checkpoint without a generated baseline.
3. Run the census from the clean checkpoint, capture the declared measurement receipts once, review unresolved observations, and generate the machine-readable baseline and human projections from that frozen input set.
4. Commit the reviewed baseline and verify the census core and projections are byte-identical when regenerated from the same source and frozen receipt identities.
5. Make the resulting baseline the required input to `establish-modular-monolith-refactor-charter`; do not activate any architecture gate from this change.

Rollback removes the additive generator, tests, and baseline artifacts. There is no application, database, runtime, CI, or production rollback because this change does not mutate those surfaces.

## Open Questions

None for this change. Final target ownership, enforcement thresholds, quarantine dispositions, and package/workspace timing are deliberately assigned to later changes.
