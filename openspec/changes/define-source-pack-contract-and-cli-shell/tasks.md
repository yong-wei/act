## 1. Contract

- [ ] Define Source Pack query, item, citation, access, coverage, limitation, audit, and output types.
- [ ] Add runtime validation or schema checks for generated packs.
- [ ] Add compact Markdown and JSON serializers that preserve stable ids.

## 2. CLI Shell

- [ ] Add the `source:pack` package script and CLI entrypoint.
- [ ] Route CLI requests through the shared builder rather than embedding retrieval logic in the script.
- [ ] Write JSON, Markdown, and audit outputs to a target directory.

## 3. Verification

- [ ] Add fixture tests for Source Pack serialization and schema validation.
- [ ] Add CLI smoke tests for argument parsing and output files.
- [ ] Run `openspec validate define-source-pack-contract-and-cli-shell --strict`.
