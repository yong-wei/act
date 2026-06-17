## 1. Manifest Contract

- [ ] 1.1 Register `visual.annotatedMedia`.
- [ ] 1.2 Register `visual.embeddedActivity` or an equivalent stage activity layer.
- [ ] 1.3 Validate media src, alt, annotations, regions, evidence roles, reveal references, selectable annotations, and activity anchors.
- [ ] 1.4 Reject visible captions, titles, fallback text, or labels that expose file names, renderer names, module names, payload keys, or internal ids.

## 2. Renderer

- [ ] 2.1 Render image/media with hotspots, annotation lines, masks, zoom regions, evidence labels, and activity anchors.
- [ ] 2.2 Support selectable annotations and required evidence selection.
- [ ] 2.3 Support embedded activity types through shared response contracts.
- [ ] 2.4 Preserve readable contrast in light, dark, mobile, desktop, and projection states.

## 3. Evidence And Diagnostics

- [ ] 3.1 Record hotspot selections, activity answers, selected evidence roles, reveal state, and submission status.
- [ ] 3.2 Reuse ordinary activity submission evidence for canvas-embedded answers.
- [ ] 3.3 Surface teacher diagnostics for most selected hotspots, missing hotspots, evidence-role confusion, and submission coverage.
- [ ] 3.4 Ensure teacher diagnostics do not expose student answer inputs.

## 4. Visual QA

- [ ] 4.1 Capture student and teacher screenshots in light and dark themes.
- [ ] 4.2 Capture non-default screenshots for selected hotspot, teacher reveal, submitted state, and diagnostic aggregation.
- [ ] 4.3 Add tests that annotated media cannot pass when hotspots are unrecorded.
- [ ] 4.4 Add tests that internal naming leaks in media frames fail the gate.

## 5. Validation

- [ ] 5.1 Run `rtk openspec validate add-interactive-annotated-media-activity --strict`.
- [ ] 5.2 Run manifest runtime, response, evidence, and visible-text leak tests.
- [ ] 5.3 Run browser audit for both student and teacher roles.
