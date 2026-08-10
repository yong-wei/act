## Context

`export_runtime.py` already treats authoring cards as the editable source and copies selected canonical cards into runtime filenames keyed by graph node ID. It previously skipped missing source cards, leaving a graph node with no card resource and no durable explanation. All 541 uncovered nodes are present in the authoring base graph and have names and definitions suitable for a minimal standard card.

## Decisions

### 1. Preserve authoring as the only editable card truth

Missing cards are generated from `course-content/authoring/knowledge/base/knowledge_graph.json`. Runtime files continue to be produced only by `export_runtime.py`; runtime content is never copied back or edited as source.

### 2. Use explicit four-way coverage

Every canonical graph node is classified as `linked`, `missing_authoring`, `invalid_mapping_or_runtime`, or `excluded`. Exclusions live in `card-exclusions.json` and require both a known node ID and a non-empty reason. A node cannot be both excluded and card-backed.

### 3. Enforce identity at both export boundaries

Before runtime directories are reset, export verifies that every non-excluded node has an authoring card whose frontmatter `node_id` equals the canonical graph node ID. After copying, export verifies that the runtime filename is canonical and byte-identical to authoring. Missing or invalid states abort export.

### 4. Materialize conservatively

The materializer writes only missing base-graph cards, never overwrites an existing canonical or selected-card file, and refuses nodes without a name or definition. Generated cards use the existing `## 首页` and `## 详情` structure and retain definitions, formulas, examples, and keywords from authoring data.

## Risks / Trade-offs

- The change adds many small Markdown files because the acceptance requirement makes each standalone graph node directly inspectable. Keeping only generated runtime content would violate authoring ownership.
- Minimal cards inherit the depth of existing base-graph metadata. Future editorial enrichment can revise individual authoring cards without changing the coverage contract.

## Testing Strategy

- Python tests cover all four dispositions, alias selection, runtime drift, exclusions, materialization, non-overwrite behavior, and export integration.
- The existing TypeScript runtime-knowledge export test verifies the committed coverage summary and every graph node's canonical card path.
- Browser acceptance opens representative formerly missing nodes in `/knowledge` and confirms that their card content loads.
