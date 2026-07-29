# ACT ReleaseSet Delta Contract

This document freezes the ACT-owned ReleaseSet Delta boundary introduced by
`govern-actkg-release-set-deltas` (#1132). It is the contract consumed by later
course/resource governance and consumer migrations.

## Ownership split

| Concern | Owner | Entry |
| --- | --- | --- |
| Frozen CTKG 0.2 exact import (#1125) | exact adapter | `scripts/actkg-release/ctkg-0-2-aggregate-release.ts` |
| Standard candidate persistence (#1131) | importer | `scripts/actkg-release/standard-bundle-import.ts` |
| ReleaseSet Delta recompute + receipt (#1132) | delta calculator | `scripts/actkg-release/release-set-delta.ts` |
| Ordinary CLI | compute command | `npm run db:compute-actkg-release-set-delta` |
| Course/resource role decisions | later #1126 change | not in this boundary |
| RAG/KAQ/SAR/path/fact migration | later consumer changes | not in this boundary |
| Production selector activation | later cutover change | not in this boundary |

## Authority

1. ACT recomputes every Delta from two fully verified database snapshots.
2. Upstream `actkg-release-diff/1` is optional cross-check evidence only.
3. Mutually supported upstream fields must agree with ACT; disagreement rejects
   downstream authorization (`REJECTED_UPSTREAM`) and emits no signals.
4. Upstream is never the calculation source of truth.
5. Multiple `release_diff` Artifacts on one Bundle fail closed (ambiguous).

## Accepted base selection

- An accepted base is either:
  - exact #1125 import receipt (`candidateState=CANDIDATE`), or
  - standard Bundle packaging receipt (`candidateState=ACCEPTED_CANDIDATE`) with
    matching semantic import receipt.
- **Every base must be strictly prior** to the candidate acceptance time
  (`acceptedAt < candidate.acceptedAt` only). Equal timestamps are never
  previous. Standard Bundle acceptance stamps a globally strictly increasing
  `importedAt` under a global advisory lock so total order does not rely on
  lexical ID tie-breaks.
- Preference among priors:
  1. same-release packaging predecessor
  2. latest cross-release prior
  3. latest remaining prior
- Current environments freeze #1125 `control-theory-engineering-v0.2` as the
  base for the first standard candidate.
- `BASELINE` is emitted only when the installation has no prior accepted
  evidence at all.
- Recomputing a historical candidate after later Releases arrive keeps the
  original previous base, `naturalKey`, and receipt identity.

## Covered collections

| Collection | Identity | Change classes |
| --- | --- | --- |
| objects | Canonical / entity id | added, removed, payload_changed, type_changed, tier_changed, superseded |
| relations | relation id | added, removed, predicate_changed, direction_changed, tier_changed, endpoint_changed |
| Crosswalk | publishedEntityId + retrievalChunkId + citationTargetId | added, removed |
| components | component release id | added, removed, changed |
| projections | profile | added_profiles, removed_profiles, digest_changed |
| vocabulary | type / predicate name | added + removed types/predicates |

## Fail-closed identity integrity

Delta computation rejects (no ACCEPTED signals) while still recording the
observed changes in details/summary:

- same Canonical ID with different canonical type → `typeChanged` + violation
- same Canonical ID with material identity replacement (`canonicalType` +
  `semanticName`) without supersession → violation
- same relation id with in-place endpoint or direction replacement →
  `endpointChanged` / `directionChanged` + violation

Display-name / description-only payload edits remain `payload_changed` and may
authorize signals when identity holds.

## Packaging revisions

When Release id/hash, source dataset hash, and semantic collection digests are
unchanged, classification is `COMPATIBLE_PACKAGING_REVISION`:

- Bundle receipt identity is preserved on the Delta receipt
- semantic change sets are empty
- no candidate/invalidation signals are emitted

## Capture revision

`captureRevision` on the receipt is the trusted ACT **delta implementation**
Git HEAD from `resolveTrustedCaptureRevision` over delta-protected paths
(`DELTA_CAPTURE_PROTECTED_PATHS`). Rules:

- real process Git only
- protected paths must be tracked and clean (no staged/unstaged/untracked drift)
- optional `expectedCaptureRevision` / `--capture-revision=` is only an equality
  assertion against that HEAD
- never fall back to releaseId or evidence capture as the implementation revision
- evidence-level capture revisions are stored separately as
  `baseEvidenceCaptureRevision` / `candidateEvidenceCaptureRevision`

## Receipt and signals

### `ActkgReleaseSetDeltaReceipt` (immutable)

Binds:

- base/candidate evidence kinds and full identities
  (ReleaseSet / Release id+version+hash / Bundle id+revision+digest /
  runtime Projection id+digest (required for exact_import and standard_bundle) /
  evidence capture revisions / semantic snapshot digests)
- `classification = BASELINE` if and only if `baseEvidenceKind = none`
- algorithm version `actkg-release-set-delta/1`
- ACT delta implementation capture revision
- classification and authorization state
- input/output digests
- detailed changes + summary counts
- identityViolations (always persisted, even when empty)
- upstream cross-check status

Unique on `naturalKey` and `(inputDigest, algorithmVersion)`.
Natural key / input digest include the complete stable evidence identity.
Recompute of identical inputs is idempotent. Same natural key with different
output digest fails closed.

### `ActkgReleaseSetDeltaSignal` (immutable, ACCEPTED only)

Stable structural fields only:

```text
scope, identity, action, reason, optional digests, signalDigest
```

Scopes: `object | relation | crosswalk | component | projection | vocabulary`  
Actions: `candidate | invalidation`

Allowed digests keys: `replacement | predecessor | baseDigest | candidateDigest`.

Signals never decide:

- course coverage roles
- resource teaching roles
- teaching relations
- candidate / active / Legacy selector movement

Validation is structural (whitelist), not string-token bans on identity values.
Legal Canonical IDs may contain tokens such as `active` or `legacy`.

Vocabulary removals emit `invalidation` signals for removed types/predicates.

## CLI

```bash
# After a standard Bundle import (also auto-invoked by the import CLI)
npm run db:compute-actkg-release-set-delta -- \
  --candidate-release-id=ctr:release:control-theory-engineering-v0.3 \
  --bundle-digest=<bundleDigest>

# Verify-only (never writes)
npm run db:compute-actkg-release-set-delta -- \
  --candidate-release-id=ctr:release:control-theory-engineering-v0.3 \
  --bundle-digest=<bundleDigest> \
  --verify-only
```

Import integration recomputes the Delta after ACCEPTED_CANDIDATE verification.
`candidateReleaseId` must match the loaded Bundle/Release or the call fails closed.

## Explicit non-goals

- No course role, resource role, or teaching-relation adjudication
- No RAG / KAQ / SAR / path / learning-fact migration
- No movement of default candidate, active, or Legacy selectors
- No production authority cutover
- No expansion of `actkg-release-diff/1` mutually-supported fields
  (Projection is not in that contract)

## Local verification

```bash
npx vitest run src/lib/__tests__/actkg-release-set-delta.test.ts
npm run test:actkg-release-set-delta-postgres   # requires clean delta protected paths
rtk openspec validate govern-actkg-release-set-deltas --type change --strict
```
