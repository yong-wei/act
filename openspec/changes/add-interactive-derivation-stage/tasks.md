## 1. Manifest Contract

- [ ] 1.1 Register `visual.derivationStage`.
- [ ] 1.2 Validate stage id, coordinate system, formulas, text blocks, connectors, reveal steps, formula blocks, regions, color roles, and teacher control metadata.
- [ ] 1.3 Reject formulas that lack LaTeX source or use image/text-only formulas.
- [ ] 1.4 Reject reveal steps with duplicate ids, missing targets, or invalid target references.

## 2. Renderer

- [ ] 2.1 Render formulas through KaTeX/LaTeX.
- [ ] 2.2 Support arbitrary two-dimensional reveal order.
- [ ] 2.3 Support long formula split rendering and progressive reveal by formula block.
- [ ] 2.4 Support formula block color roles: `known`, `transform`, `cancel`, `target`, `risk`, and `result`.
- [ ] 2.5 Support local highlight for individual formula blocks and connectors.
- [ ] 2.6 Preserve readable layout in light, dark, mobile, desktop, and projection states.

## 3. Teacher And Student Flow

- [ ] 3.1 Add teacher controls for next, previous, arbitrary jump, temporary highlight, answer reveal, and reset.
- [ ] 3.2 Persist teacher reveal state across refresh.
- [ ] 3.3 Show student unreleased, released, browsed, and submitted states.
- [ ] 3.4 Record student answer by reveal step.

## 4. Evidence And Diagnostics

- [ ] 4.1 Record `stageId`, max reveal step seen, visited reveal steps, formula block focus events, and answer by reveal step.
- [ ] 4.2 Show teacher diagnostics for reveal step distribution, unvisited formula blocks, formula block misconceptions, and submitted count.
- [ ] 4.3 Ensure diagnostics do not expose student answer input controls in teacher mode.

## 5. Visual QA

- [ ] 5.1 Add tests for non-linear reveal order.
- [ ] 5.2 Add tests for long formula progressive reveal.
- [ ] 5.3 Add tests for formula block color roles.
- [ ] 5.4 Add browser screenshots for teacher arbitrary jump and student released state.
- [ ] 5.5 Fail acceptance if formulas are not rendered through KaTeX/LaTeX.

## 6. Validation

- [ ] 6.1 Run `rtk openspec validate add-interactive-derivation-stage --strict`.
- [ ] 6.2 Run manifest runtime tests and interactive evidence tests.
- [ ] 6.3 Run browser audit for both student and teacher roles.
