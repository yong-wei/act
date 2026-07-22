## Why

The `/knowledge` graph canvas will eventually be fed by the ActKG ontology rebuild (`GraphProjection` with `ProjectedNode`/`ProjectedLink`, rich node attributes, edge `evidence_state` and `version_digest`), but the current public graph contract (`PublicKnowledgeGraphNode`/`PublicKnowledgeGraphLink`) carries none of those fields, and edge evidence state exists only inside inspector provenance. Without a projection-shaped contract and a server-side adapter, every future visual improvement would couple the renderer to one-off data wrangling, and the ActKG switchover would force a renderer rewrite instead of a source swap.

## What Changes

- Extend the public graph payload with optional, projection-shaped fields: link `evidenceState` (derived today from existing relation evidence fields), node `semanticName`, `conceptKind`, `candidate`, and `sourceCoverageCount` (absent from current data; no visual change today).
- Add a third graph source to `src/lib/knowledge-graph-source.ts`: an environment-gated ActKG `GraphProjection` JSON adapter that maps `ProjectedNode`/`ProjectedLink` into the existing unified payload, including `version_digest` → `graphVersion`/`versionDigest` mapping and projection identity validation.
- Register a canonical `association` relation type in the relation contract so ActKG's three-value `relation_type` projection (`contains`/`prerequisite`/`association`) round-trips without contract violations, and define the precedence rule when projected `direction` conflicts with the canonical contract table.
- Ship an ActKG projection fixture (derived from the published ActKG JSON Schema) plus contract tests proving the adapter output passes existing relation-contract, coverage, and payload-budget validation.
- No renderer, layout, interaction, or visual changes; current file/DB sources remain the default and are byte-identical in output shape.

## Capabilities

### New Capabilities

- `knowledge-graph-projection-contract`: The projection-facing public node/link field contract, evidence-state derivation for current data, the ActKG `GraphProjection` source adapter, canonical `association` type registration, and projection version binding.

### Modified Capabilities

None. Visual grammar, density, and interaction requirements are unchanged; encoding the new fields on canvas is delegated to the follow-up change `encode-knowledge-graph-evidence-visuals`.

## Impact

- Affects `src/lib/knowledge-graph-source.ts` (public types, third source, version mapping), `src/features/knowledge/graph/relation-contract.ts` (canonical `association` registration, direction-conflict precedence), and their focused Vitest suites; adds an ActKG projection test fixture.
- No API route shape breaking changes (new fields optional), no database migration, no renderer changes, no dependency additions.
- Follow-up change `encode-knowledge-graph-evidence-visuals` depends on this contract and must not start before it lands.
