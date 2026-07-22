# Tasks: extend-knowledge-graph-projection-contract

## 1. Public payload contract

- [x] 1.1 Add optional `evidenceState?: 'available' | 'unavailable'` to `PublicKnowledgeGraphLink` and optional `semanticName?`, `conceptKind?`, `candidate?`, `sourceCoverageCount?` to `PublicKnowledgeGraphNode` in `src/lib/knowledge-graph-source.ts`, documenting absence-means-unknown semantics.
- [x] 1.2 Extract the evidence-availability derivation into one shared helper used by both the server payload builder and the inspector relation runtime, and populate link `evidenceState` for file and database sources.
- [x] 1.3 Add contract tests: current sources omit the new node fields; link `evidenceState` agrees with inspector derivation on the runtime relations corpus; pre-existing payload fields are unchanged in name, type, and value.

## 2. Canonical association type

- [x] 2.1 Register canonical relation type `association` (family `association`, direction `unordered`) in `src/features/knowledge/graph/relation-contract.ts` with detail sentence and visual semantics entries as required by the contract registry.
- [x] 2.2 Add/adjust contract tests proving projected `contains`/`prerequisite`/`association` round-trip, and that every previously registered canonical type keeps family, direction, strength normalization, and dedup behavior.

## 3. ActKG projection adapter

- [x] 3.1 Vendor the ActKG projection JSON Schema snapshot and build a typed fixture projection (with pinned ActKG release identity) under test fixtures.
- [x] 3.2 Implement the `actkg-projection` source in `knowledge-graph-source.ts`: env-gate resolution, schema validation, `ProjectedNode`/`ProjectedLink` field mapping, fail-closed errors for missing/malformed/invalid documents with no silent fallback.
- [x] 3.3 Bind `version_digest` (+ release identity) to `graphVersion`/`versionDigest` and prove shard-key validation and version-change layout invalidation work through existing paths.
- [x] 3.4 Implement direction-conflict precedence (canonical table wins, conflict recorded in provenance) with tests for both conflict and agreement cases.
- [x] 3.5 Adapter tests: gate unset leaves default source selection untouched; valid fixture passes relation-contract validation, coverage checks, and node/link/byte budgets; malformed documents fail closed descriptively.

## 4. Validation

- [x] 4.1 Run focused knowledge graph suites (`relation-contract`, graph source, progressive loading, relation coverage route) plus `rtk npm run typecheck`; fix in-scope failures.
- [x] 4.2 Run `rtk openspec validate extend-knowledge-graph-projection-contract --type change --strict` and resolve all findings.
- [x] 4.3 Obtain independent code review clearance for the final diff and resolve all blocking findings.
