## 1. Knowledge Workspace

- [ ] 1.1 Redesign knowledge graph desktop and mobile layout as canvas-first.
- [ ] 1.2 Move mobile chapter directory, relation filters, and legend into drawers or sheets.
- [ ] 1.3 Preserve ResourceNode launch, privacy, availability, and evidence status semantics.
- [ ] 1.4 Verify selected knowledge nodes can launch ResourceNode, course resource, simulation, or lesson entry when available and can return to learning path or evidence review.
- [ ] 1.5 Register `KnowledgeGraphSystem`, knowledge route shell, and knowledge visual QA profiles in the route ledger.

## 2. Data Surfaces

- [ ] 2.1 Align data center presentation with knowledge/data map visual language.
- [ ] 2.2 Add source quality, freshness, privacy scope, and status legend treatment.
- [ ] 2.3 Ensure `/data-center` ownership is consistent with route ledger.
- [ ] 2.4 Verify `PresentationDataCenter` carries source quality, freshness, privacy scope, and action context rather than decorative metric blocks.

## 3. Verification

- [ ] 3.1 Capture `/knowledge` default, filtered, and selected-node screenshots at 1440px and 320px in light/dark themes.
- [ ] 3.2 Verify 320px `/knowledge` first viewport shows usable graph/canvas area.
- [ ] 3.3 Verify the known 320px squeeze-down failure is rejected when permanent directory and filter panels hide the graph/canvas.
- [ ] 3.4 Run `rtk openspec validate redesign-knowledge-and-data-surfaces --strict`.
