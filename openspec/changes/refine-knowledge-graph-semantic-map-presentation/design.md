## Context

The current specs already require semantic relation styles, fine lines, graphical legends, Chinese labels, bounded node scale, and high-signal default density. Product Design review found that the actual UI can still fail those goals visually: prominent bright lines, insufficient cluster structure, and weak neighborhood hierarchy can make the graph feel like a database tangle.

This change is therefore an implementation owner for the remaining presentation gap. It does not reopen taxonomy or authoring data decisions.

## Goals / Non-Goals

**Goals:**

- Make relation edges visually subordinate and distinguishable through line grammar, not saturation alone.
- Use semantic cluster territories or equivalent grouping cues so learners can perceive conceptual regions.
- Make node scale, halo, focus ring, label priority, and neighborhood dimming communicate importance and current context.
- Keep light and dark modes visually equivalent and aligned with platform tokens.
- Prove the result with current browser evidence and source/runtime checks.

**Non-Goals:**

- Define new relation types or data semantics.
- Own hover/click/drag layout stability; that belongs to `stabilize-knowledge-graph-interaction-state`.
- Own local tool placement or inspector layout; that belongs to `redesign-knowledge-workspace-tools-and-inspector`.

## Concept Adoption

- Adopt from `layered-research-atlas.png`: cluster territories, restrained graph texture, focus-centered hierarchy, and fine-line relation grammar.
- Adopt from `night-bridge-semantic-map.png`: premium dark depth and selected-node emphasis without heavy global glow.
- Adopt from `daylight-engineering-atlas.png`: light-mode clarity, low-noise edges, and readable node labels.
- Reject exact generated node positions, generated relation labels, standalone shell chrome, and any visual treatment that conflicts with shared AppShell tokens.

## Decisions

### 1. Presentation is a separate owner from taxonomy

Existing specs define what relation families mean. This change owns whether the actual rendered graph communicates those meanings as a readable map.

Alternative considered: rely only on governance to catch failures. That leaves no executable owner to fix the presentation.

### 2. Edges stay quiet until context asks for emphasis

Default relation lines should be thin and low-emphasis. Selection, explicit focus, or active filters can intensify relevant edges, while unrelated edges dim.

Alternative considered: permanently vivid relation colors. That recreates the current tangle.

### 3. Cluster cues are allowed when semantic, not decorative

Cluster territory outlines, subtle regions, or equivalent grouping cues are acceptable when derived from chapter, concept category, or graph structure. They should help reading, not become decorative blobs.

## Risks / Trade-offs

- Very fine lines can become invisible. Mitigation: define minimum contrast and test both themes.
- Cluster regions can look decorative or inaccurate. Mitigation: derive regions from explicit semantic grouping and show them only when they improve readability.
- Graph styling can drift from legend styling. Mitigation: use shared visual config for graph and legend samples.

## Dependencies

- Depends on archived visual grammar and clarity specs.
- Should coordinate with `stabilize-knowledge-graph-interaction-state` so focus styling does not cause layout jitter.
- Should precede `govern-knowledge-workspace-product-qa`.
