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
| Upstream reviewed packaging commit | `35250ad0ac81f1f020107d831a0f2a4b290c39a0` |
| Positive packaging fixture | `control-theory-engineering-v0.5` |
| Negative incomplete fixture | `scripts/actkg-release/fixtures/control-theory-engineering-v0.3-unfixed` |

Machine-readable identities live in:

- `scripts/actkg-release/contract-identities.json`
- `scripts/actkg-release/bundle-compatibility-registry.ts`
- `scripts/actkg-release/schemas/public-bundle/*`

## Current compatible content release

The current reviewed governance intake is the M1G stability ReleaseSet. Its
Bundle Manifest and Validation Report bind semantic source commit
`1255a337a8863e83d8f0d10b4afb09ac8ba76c68`:

| Layer | Publication tag | Bundle digest | Release hash |
| --- | --- | --- | --- |
| Module | `stability-analysis-engineering-v0.1` | `0c484509f524d10a9ad1c6b273c93cdb885327ce951a084a26fcfc1cf5965e67` | `70fd22fba92301085e73055caa4c98e1428762eb954610abaeceb0b4bf333ece` |
| Integration | `control-theory-integration-v0.3` | `f0d3866fe65e9ac16edaf2d4cedf605f5a4ae94131eb4869c8678604acc20412` | `345707df46013c88db5fe7a620e26d54378efc5b474f2f506422204ddbe0c205` |
| Aggregate | `control-theory-engineering-v0.5` | `186ed42ff29c038e6c7ce43265d86c4e9866c13bd9fec2651209668d8f6302c2` | `33e464b0617c21dec92a6ed98a0b95f78e8e27f31e4e988dc59de21afd5b4bde` |

The aggregate is pinned by
`course-content/authoring/knowledge/releases/release-set.lock.v3.control-theory-engineering-v0.5.json`.
Its component chain preserves the legacy root-locus and system-modeling
packages, reuses the standard time-domain module, and adds the standard
stability module and v0.3 integration Bundle. Only the aggregate is a
top-level governance intake target.

The annotated source tags
`stability-analysis-engineering-v0.1-source`,
`control-theory-integration-v0.3-source`, and
`control-theory-engineering-v0.5-source` currently dereference to packaging
commit `35250ad0ac81f1f020107d831a0f2a4b290c39a0`. That tag target does not
replace the embedded semantic `source_revision.commit` above.

M1G provenance explicitly declares
`graph_rag_runtime_intake=BLOCKED`. The compatibility layer exposes this as
`ValidatedActKGBundle.graphRagRuntimeIntakeBlocked=true` and rejects any
different declared disposition. Older compatible packages without this field
also remain blocked by default. This is governance intake only: no Graph-RAG
runtime path, selector, API, or UI is enabled.

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
