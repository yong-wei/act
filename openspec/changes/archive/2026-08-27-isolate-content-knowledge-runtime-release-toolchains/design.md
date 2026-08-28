# Design: Content, knowledge, and runtime release toolchains

## Baseline and characterization

The baseline is `edb98945e78ab0824f801806751fd57f97056347`. The initial source
denominator is the complete set of tracked entries returned by
`git ls-files -- <path>` in this captured Git tree: 41 under
`course-content/scripts`, 7 under `scripts/knowledge`, 52 under
`scripts/knowledge-cutover`, 32 under `scripts/runtime-release`, and 5 under
`scripts/release`. Each entry is classified as a compiler/exporter, validator,
publication writer, candidate/qualification adapter, runtime reader, or
operator activation/deployment adapter. Files serving the product reader or a
canonical contract are not moved merely because they share a directory.

Ignored, untracked, generated, and runtime-created files are not source
denominator entries, including `__pycache__/` and `*.pyc`. The characterization
fixture records the captured-tree SHA, each exact tracked-entry list or digest,
and the counts above, plus an explicit excluded-entry observation. If a future
release requires a generated/untracked input, the fixture records it only as a
separate `generated-input` item with producer/version, path class, content
digest, and source revision.

Before migration, record callers, package-script names, source revision and
capture inputs, ReleaseSet/Bundle identity, manifest fields, database/result
writes, output hashes, and failure behavior. Characterization must include an
authoring-to-runtime export, a locked knowledge bundle, and a runtime v2
materialization/inspection path. These characterization fixtures must resolve
only to the captured tracked entry list or to separately declared
`generated-input` records; they must not silently include ignored/untracked
files.

## Boundary model

### Content compiler

The content tool consumes reviewed authoring content and emits the existing
runtime content shape with provenance, validation, and source/capture identity.
It does not become a runtime reader and does not write a production selector.

### Knowledge release

The knowledge tool consumes an explicit locked ReleaseSet/Bundle and produces
the existing lossless public bundle, projection inputs, manifests, and
qualification receipts. It uses the teaching-projection CLI for projection
publication and leaves a failed or incomplete candidate non-selectable.

### Runtime release

The runtime tool builds, materializes, verifies, inspects, and records an
immutable content-addressed release. Publication is manifest-last and
append-only as required by the runtime specs. Host activation, rollback, and
coordinated selector changes remain explicit operator/coordination adapters and
are not hidden inside a tool entrypoint.

## Shared contracts and receipts

All three tools use one typed release identity containing source revision,
capture/release set identity, manifest hash, artifact hashes, and tool version.
Database results and public bundles carry that identity; a result from a
different capture cannot be silently joined. Paths in receipts are portable
relative paths or content-addressed references, never local absolute paths.
Private evidence and run-specific QA output remain outside public runtime
bundles.

## Migration, deletion, and rollback

Migrate callers and package scripts to the registry entrypoints in dependency
order: content export, knowledge publication, then runtime release. Run output
characterization and graph/import checks after each vertical path. Delete old
entrypoints and forwarding modules only after the corresponding tool and
consumer checks pass. On failure, stop at the failed path and retain the
uncommitted old code for diagnosis; do not activate a partially migrated
release or alter production state.

## Dependencies and non-goals

The design depends on the independent boundary and split graph changes and on
the teaching-projection CLI. It reuses `authoritative-knowledge-release-ingestion`,
`authoritative-knowledge-repository`, `content-addressed-runtime-release-storage`,
`oss-runtime-release-management`, `canonical-knowledge-resource-binding`, and
the content/runtime specifications. The active coordination change owns
selector/cutover semantics. This change does not alter runtime meaning,
resource selectors, deployment, or database schema.
