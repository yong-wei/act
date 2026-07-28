# ActKG projection schema snapshot

`ctkg-projection.schema.json` is a verbatim vendored copy of the published ActKG
LinkML-generated JSON Schema.

- Source: the ActKG project's `project/jsonschema/ctkg.schema.json` (sibling
  checkout; published at `https://yong-wei.github.io/ActKG/ctkg/`, draft 2019-09)
- Pinned ActKG release: `3f7c58760aa70011990af28977cd03e51ba7c985` (2026-07-22)
- Pinned CTKG `schema_version`: `0.1.0`

The environment-gated ActKG adapter in `src/lib/knowledge-graph-source.ts`
validates `GraphProjection` documents against this snapshot and fails closed on
any drift. When ActKG publishes a new schema, re-copy the file and update the
pin above and in `src/lib/__tests__/fixtures/actkg/actkg-projection.fixture.ts`.

# CTKG 0.2 aggregate consumer contract

The authoritative candidate ReleaseSet is governed by the CTKG 0.2 aggregate
consumer contract recorded in
`course-content/authoring/knowledge/releases/release-set.lock.json`
(`actkg-release-set-lock/v2`). The exact consumer Schema snapshot is vendored
inside the locked package at
`course-content/authoring/knowledge/releases/control-theory-engineering-v0.2/ctkg.schema.json`
and is byte-identical to the upstream file.

- Reviewed ActKG publication commit: `7ab6041201f3c23963a8ddb2685256a5418ad532`
- Reviewed ActKG closing commit: `f5f442e99324af731e0b5226a22b0973e838621b`
- Pinned CTKG `schema_version`: `0.2.0`
- Schema SHA-256: `3598f0c89f1f32ff1812e823454a17502873ccb5e9577656e6485a7e030233de`
- Canonicalization: `canonical-json/rfc8785-subset-v1` (key-sorted JSON; the
  release hash is the SHA-256 of the canonical release record without its
  `release_hash` field)
- Public artifact hashes: the ReleaseSet lock entry (release, GraphProjection
  V2, RAG crosswalk, component manifest, `SHA256SUMS`, release notes, vendored
  Schema) plus the two component lineage records

The exact CTKG 0.2 bundle adapter lives in
`scripts/actkg-release/ctkg-0-2-aggregate-release.ts`; the CTKG 0.1 adapter in
`scripts/actkg-release/authoritative-release.ts` is retained only for
historical reads and regression against its immutable fixture lock. Neither
adapter claims compatibility with an unknown future Schema version.
