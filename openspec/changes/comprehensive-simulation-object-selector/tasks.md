## 1. Object Selector Structure

- [ ] 1.1 Locate the current object selection surface and add tests for collapsed and expanded states.
- [ ] 1.2 Implement collapsible object groups while keeping the selected object summary visible.
- [ ] 1.3 Preserve object selection updates through the existing workbench session and preset context.

## 2. Model And Metadata Presentation

- [ ] 2.1 Render typical and white-box object models as LaTeX/KaTeX formulas.
- [ ] 2.2 Replace plain-text object metadata with labels or badges for source, visibility, model type, and compatibility.
- [ ] 2.3 Add incompatible-object feedback that leaves the current valid working model unchanged.

## 3. Theme And Interaction Validation

- [ ] 3.1 Strengthen selected-object colors, borders, and text states for light and dark themes.
- [ ] 3.2 Add DOM or component assertions for selected state, labels, formula rendering, and incompatible selection.
- [ ] 3.3 Run `openspec validate comprehensive-simulation-object-selector --strict` and targeted frontend tests.
