## Context

The #1117 stage change ends with a pinned, read-only r3 snapshot: 3,609 CourseCoverage candidates, 1,772 profile-only records, and two role-type blockers. It proves import and Delta provenance but does not prove teaching semantics, production readiness, or a safe authority switch. This change is the follow-up boundary for the remaining course review, Teaching Projection, consumer migration, production rehearsal, and Legacy retirement.

The final gate spans ACT authoring and review data, ActKG release artifacts, graph/RAG/KAQ/SAR/resource/path consumers, learning-fact writers, deployment operators, and user-facing history. A single cross-capability capability keeps the cutover decision atomic while leaving existing domain contracts as their owners.

## Goals / Non-Goals

**Goals:**

- Re-resolve and freeze the latest eligible Release before every final handoff and before cutover; use #1117 only as a versioned input, never as production proof.
- Obtain independent item-level decisions for all 3,609 worklist records, preserve the 1,772 profile-only boundary, and produce a reviewable nine-role Mapping with explicit alternatives.
- Establish separate activity/evaluation and scene-migration capability contracts, then create a formally versioned Teaching Projection, handoff, and attestation.
- Prove all formal consumers and Canonical writers are ready and switch them in one downtime transaction backed by a latest-production rehearsal.
- Preserve historical access through a permission-aware Legacy Archive, retire old business runtime reads, and reset Legacy-bound UI state without identity mapping.

**Non-Goals:**

- No reuse of the old Coverage verdict, approximate role binding, engineering predicate inference, or conversion of a stage snapshot into a cutover receipt.
- No partial consumer rollout, online dual authority, reverse Legacy mapping, or Canonical writes before the final transaction.
- No new domain-specific replacement for existing graph, RAG, KAQ, SAR, resource, path, or learning-fact contracts; this change supplies their shared final gate.

## Decisions

1. **Latest release is resolved twice.** Resolve the latest admissible ReleaseSet through the registered Bundle/Schema/Delta chain before review freeze and again immediately before cutover. If the endpoint changes, invalidate downstream review and regenerate from the new digest. An explicit binding file is preferred over silently selecting a directory or version string.

2. **Review is item-level and provenance-bound.** Every one of the 3,609 worklist items receives an independent decision keyed by canonical ID, current worklist input digest, Release/Delta identities, source evidence, and authoring revision. The 1,772 profile-only rows remain pending until evidence beyond the Canonical profile is independently reviewed. Historical decisions may explain prior work but cannot satisfy this gate.

3. **Role contracts precede Mapping.** Each of the nine roles receives independent `Primary` and `Challenger` review decisions; a `Third` adjudicator is required only when those decisions disagree. “仿真验证与跨模型比较” is an activity/evaluation capability; “现代控制与船海迁移” is a scene-migration capability. Neither is approximated by a nearby Canonical knowledge object. Mapping closes only after candidate rationale, rejected alternatives, reviewer identities, and any adjudication decision are persisted.

4. **Teaching Projection is an attested handoff.** ACT exports a versioned handoff containing the frozen Release and CourseCoverage identities, role mappings, conflicts with existing KAQ knowledge-to-knowledge relations, and all evidence digests. ActKG returns a formal Teaching Projection; ACT validates its schema, membership, relation semantics, and digest before an independent attestation records acceptance. Missing or conflicting teaching semantics block the gate.

5. **One authority transaction.** Graph, Konling, RAG, SAR, KAQ, effective resources, CourseCoverage, path planning, and Canonical learning-fact writers each expose a readiness receipt for the same ReleaseSet, Projection, Mapping, and digest. A single transaction activates every selector and writer fence together. Any missing receipt or Legacy selector aborts before reopening service.

6. **Production rehearsal precedes downtime.** Export the latest production database, restore it into an isolated environment, and run the exact application revision, schema migrations, ReleaseSet, Projection, and smoke suite. Record row counts, hashes, duration, failures, and rollback timing. Only the rehearsed command sequence may be used during the production downtime window.

7. **Rollback is write-boundary aware.** Before a Canonical fact is accepted, failed smoke checks keep service stopped and permit restoring the backup and old application. After the first Canonical fact, Legacy cannot become active again; operators stop service and apply a forward repair with an append-only audit record.

8. **Archive is independent and read-only.** The Legacy Archive captures the fixed old nodes, relations, revisions, unfinished paths, and notes at the cutover boundary. Existing content visibility is preserved, note bodies remain owner-only, and administrators receive only governed audit access. The archive has no graph business API, AI, recommendation, resource, path, or learning-fact write contract.

9. **UI state is reset, not mapped.** Favorites, canvas layouts, and recent visits whose keys belong to Legacy are cleared from the active workspace. Notes remain reachable only through the archive; no Legacy ID is translated into a Canonical ID.

## Risks / Trade-offs

- [Review volume or profile-only evidence delays the release] → Make the worklist resumable by digest, retain per-item decisions, and fail closed on missing rows instead of accepting a partial denominator.
- [Role contracts become a proxy for knowledge nodes] → Validate the contract kind before Mapping and require a rationale for every rejected candidate.
- [Release drift invalidates a nearly complete review] → Re-resolve immediately before handoff and cutover; no silent rebasing.
- [Downtime exceeds the approved window] → Measure the restored production rehearsal and require an explicit rollback threshold before scheduling the window.
- [Archive leaks private notes or becomes a second runtime] → Reuse role-scoped authorization, separate archive storage/route, and deny business-runtime callers at the contract boundary.

## Migration Plan

1. Freeze the review input and complete independent CourseCoverage and role Mapping; publish the activity/evaluation and scene-migration contracts.
2. Export and attest the Teaching Projection handoff; obtain readiness receipts from every formal consumer and Canonical writer.
3. Re-resolve the latest Release, rehearse the complete migration on the latest production export, and approve a bounded downtime/rollback window.
4. Stop application, worker, and scheduler; create the production backup; execute the rehearsed migration and one authority transaction; run read, permission, archive, worker, scheduler, and write-boundary smoke checks.
5. Reopen only after all checks pass. If checks fail before Canonical writes, restore the backup and old application; otherwise keep service stopped and execute a forward repair.
6. Materialize the archive and reset active Legacy UI state as part of the same release, then retire old DTOs, business APIs, caches, and formal runtime readers.

## Open Questions

None. Any new release, role, or deployment ambiguity is a blocking readiness finding and requires a new reviewed handoff rather than an implicit decision.
