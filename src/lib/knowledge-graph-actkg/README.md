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
