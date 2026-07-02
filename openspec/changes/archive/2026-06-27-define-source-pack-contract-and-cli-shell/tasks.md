## 1. Contract

- [x] Define Source Pack query, item, citation, access, coverage, limitation, audit, and output types.
- [x] Add runtime validation or schema checks for generated packs.
- [x] Add compact Markdown and JSON serializers that preserve stable ids.

## 2. CLI Shell

- [x] Add the `source:pack` package script and CLI entrypoint.
- [x] Route CLI requests through the shared builder rather than embedding retrieval logic in the script.
- [x] Write JSON, Markdown, and audit outputs to a target directory.

## 3. Verification

- [x] Add fixture tests for Source Pack serialization and schema validation.
- [x] Add CLI smoke tests for argument parsing and output files.
- [x] Run `openspec validate define-source-pack-contract-and-cli-shell --strict`.
