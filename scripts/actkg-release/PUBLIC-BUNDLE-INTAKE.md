# ActKG Public Bundle Intake Boundary

This document is the ordinary intake checklist for packages that declare
`actkg-public-bundle/1`. It does **not** cover candidate database import,
ReleaseSet Delta, course coverage, resource binding, or production activation;
those belong to downstream changes.

## Reviewed contract snapshot

| Identity | Value |
| --- | --- |
| Bundle contract | `actkg-public-bundle/1` |
| CTKG Schema version | `0.2.0` |
| CTKG Schema raw SHA-256 | `3598f0c89f1f32ff1812e823454a17502873ccb5e9577656e6485a7e030233de` |
| Lock version | `actkg-release-set-lock/v3` |
| Upstream reviewed HEAD | `7f2ff5f154acf7b34a89e67b64867f16ce5b111e` |
| Positive packaging fixture | `control-theory-engineering-v0.3-r2` |
| Negative incomplete fixture | `scripts/actkg-release/fixtures/control-theory-engineering-v0.3-unfixed` |

Machine-readable identities live in:

- `scripts/actkg-release/contract-identities.json`
- `scripts/actkg-release/bundle-compatibility-registry.ts`
- `scripts/actkg-release/schemas/public-bundle/*`

## Current compatible content release

The current reviewed intake is the stable v3E three-layer ReleaseSet published
from ActKG source commit
`0c9775f25eab5a4f45b4d74e68de4dcf0cbcef46`:

| Layer | Publication tag | Bundle digest | Release hash |
| --- | --- | --- | --- |
| Module | `time-domain-analysis-engineering-v0.1` | `20807dfe406903bd9a8a4a238717d49f4abbacb3e041dab5be6068d126ec7eeb` | `52da8d2147f44749d4e1f8ffd99090f5e0d8c6ba6a8915433041d163cb51aff6` |
| Integration | `control-theory-integration-v0.2` | `f1b75e4d5e98c360e6f60bdc6abd130b3bbfd130df9cc04141d389f8d3348ead` | `c35c5acac51de4fa9a951df5fdd6c96041795a406ed7555163953f45068d4c1a` |
| Aggregate | `control-theory-engineering-v0.4` | `e17a46ce3a159cf9b0a1e35b5eddd68f7c8a21ac97ebedd281c2f18215d285c7` | `46ce6f09afba677358749f854d2797895e05dda875c8b1c197437d742c7f0b4b` |

The aggregate is pinned by
`course-content/authoring/knowledge/releases/release-set.lock.v3.control-theory-engineering-v0.4.json`.
The module and integration Bundles are validated component boundaries; only the
aggregate is a top-level candidate import target.

## Ordinary compatible-release intake

Use this path when Bundle, Schema, and required Artifact contracts are already
registered.

1. Vendor the upstream public package under an explicit controlled path.
2. Vendor every referenced component package under controlled paths.
3. Add or update a **ReleaseSet Lock v3** that pins:
   - controlled path
   - `bundle_id` / `bundle_revision` / `bundle_digest`
   - Manifest raw SHA-256
   - Release id/version/hash and `source_dataset_hash`
   - Schema version/raw hash
   - source commit/tag
   - components as either:
     - `legacy_exact` (or omitted `reference_kind` for backward compatibility):
       controlled path + `release_json_name` + raw Release JSON hash
     - `standard_bundle`: controlled path + `bundle_id` / `bundle_digest` +
       Manifest raw SHA-256 (no recursive DB import / runtime enablement)
4. Run the standard validator (`loadAndValidatePublicBundleV1` / router).
5. Confirm the assessment is one of:
   - `COMPATIBLE_CONTENT_UPDATE`
   - `COMPATIBLE_PACKAGING_REVISION`
   - `COMPATIBLE_OPTIONAL_EXTENSION`
6. Keep the resulting `ValidatedActKGBundle` as the only input to a later
   candidate-import change. Do not re-read filenames in the importer.

No OpenSpec change is required for ordinary compatible content updates.

## When an adapter update is required

Return / stop with `ADAPTER_UPDATE_REQUIRED` when any of the following appears:

- unknown **required** Artifact role
- unknown **required** Artifact contract version
- unsupported `bundle_contract_version`
- unsupported Manifest normalization
- Projection / Crosswalk / Link Metadata public structure that the registered
  contracts cannot express

Do not invent silent compatibility shims.

## When Schema review is required

Return / stop with `SCHEMA_REVIEW_REQUIRED` when:

- Schema version/raw-hash pair is not registered, even if the version string is
  familiar
- Schema snapshot bytes drift from the reviewed hash

## When integrity rejects the package

Return / stop with `INTEGRITY_REJECTED` when any closed-world check fails:

- path not confined (absolute, `..`, backslash, symlink escape)
- duplicate or case-fold-colliding paths
- Manifest / SHA256SUMS / raw Artifact hash mismatch
- file set not exactly Manifest artifacts + `bundle-manifest.json` + `SHA256SUMS`
- component identity incomplete or disagreeing across Release / Manifest /
  component-releases.json / lock
- registry `requiredForAggregate` role/contract missing or not declared
  `required:true` (including `release_notes` and core Artifacts)
- required aggregate Projection profiles (`runtime` / `domain` / `review`)
  without exactly one Link Metadata cover, or with duplicate cover
- Validation Report `source_revision` disagreeing with Manifest/Lock, or any
  appearing gate / nested evidence check reporting `FAIL`
- Release membership, Projection endpoint, Metadata one-to-one, or Crosswalk
  membership failures
- privacy boundary violations (`raw_text`, `exact_quote`, local absolute paths,
  private keys)
- declared statistics that do not match dynamic recalculation

## Historical freeze

`control-theory-engineering-v0.2` remains on:

- lock: `course-content/authoring/knowledge/releases/release-set.lock.json`
  (`actkg-release-set-lock/v2`)
- adapter: `scripts/actkg-release/ctkg-0-2-aggregate-release.ts`

No Manifest may be fabricated for it. Standard-path failures must never fall
back to that adapter.

## Downstream ownership

| Concern | Owner |
| --- | --- |
| Candidate persistence / receipts | `import-compatible-actkg-public-bundles` → `scripts/actkg-release/standard-bundle-import.ts` and `STANDARD-BUNDLE-CANDIDATE-IMPORT.md` |
| ReleaseSet Delta | later import/governance change |
| Semantic course/resource governance | course-coverage / resource changes |
| Production selector activation | explicit production switch change |
