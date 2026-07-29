# Standard ActKG Public Bundle Candidate Import

This document freezes the candidate-import boundary introduced by
`import-compatible-actkg-public-bundles` (#1131). It does **not** move production
authority, default candidate, active, or Legacy selectors.

## Ownership split

| Concern | Owner | Entry |
| --- | --- | --- |
| Frozen CTKG 0.2 exact import (#1125) | exact adapter | `scripts/actkg-release/ctkg-0-2-aggregate-release.ts` |
| Compatibility validation (#1130) | public Bundle validator | `scripts/actkg-release/public-bundle-v1.ts` → `ValidatedActKGBundle` |
| Standard candidate persistence (#1131) | importer | `scripts/actkg-release/standard-bundle-import.ts` |
| Ordinary CLI | import command | `npm run db:import-compatible-actkg-public-bundle` |
| ReleaseSet Delta / course / resource governance | later changes | not in this boundary |
| Production selector activation | later cutover change | not in this boundary |

## Unchanged #1125 exact path

- Adapter constants remain pinned to `control-theory-engineering-v0.2`.
- Historical Artifact role/profile/contract fields stay `NULL` / unavailable.
- Import receipt `candidateState` remains `CANDIDATE` for the exact path.
- Repository exact diagnosis does **not** require Manifest-only Bundle fields.
- Default candidate constants remain:

```text
actkg-authoritative-candidate-v2
control-theory-engineering-v0.2
```

## Standard import contract

1. Compatibility layer emits one deterministic `ValidatedActKGBundle`.
2. Persistence accepts **only** that object (`assertValidatedActKGBundleInput`).
3. One Serializable transaction:
   - stages Bundle Receipt as `STAGED`
   - stages Bundle Artifacts under the STAGED receipt
   - stages Release / components / entries / runtime Projection / multi-Projection
     identities / full Link Metadata / Crosswalk (content import only)
   - reconstructs and compares all public Artifacts, semantic collections,
     digests, statistics and counts
   - performs the sole allowed `STAGED → ACCEPTED_CANDIDATE` transition
   - writes the semantic import receipt only after acceptance
4. Packaging revisions with the same Release ID/hash + source dataset hash +
   semantic digests add a Bundle Receipt and raw Artifact versions only.
   Packaging Artifact counts live on `ActkgBundleReceipt.artifactCount`.
5. Identical Bundle digests are idempotent; concurrent first imports retry on
   serialization/unique conflicts and converge to one accepted receipt.
6. Identity/digest conflicts fail closed; any round-trip mismatch rolls back
   the entire transaction with no partial rows.

## Explicit candidate boundary

- Successful import makes the ReleaseSet addressable by exact
  `releaseSetId` + `releaseId`.
- Import never updates:
  - default candidate pointer
  - active pointer
  - Legacy production source selection
- Repository historical flag remains true for every ReleaseSet other than the
  pinned #1125 aggregate default.

## Downstream Delta handoff

`govern-actkg-release-set-deltas` should compare already-accepted candidate
snapshots by exact ReleaseSet/Release/Projection identities. This import change
does not compute deltas, course coverage, resource bindings, RAG/KAQ/SAR
migration, or production cutover.

## Local verification

```bash
# schema / readiness
node scripts/tests/test-docker-migration-readiness.mjs

# unit
npx vitest run src/lib/__tests__/standard-actkg-bundle-import.test.ts \
  src/lib/__tests__/authoritative-knowledge-repository.test.ts

# real PostgreSQL (requires DATABASE_URL or ephemeral local Postgres)
npm run test:standard-actkg-bundle-import-postgres

# ordinary import of the vendored v0.3 r2 packaging fixture
npm run db:import-compatible-actkg-public-bundle
```

## Production authority

Legacy remains production authority until a later, separately governed cutover.
Accepted standard candidates are non-production explicit candidates only.
