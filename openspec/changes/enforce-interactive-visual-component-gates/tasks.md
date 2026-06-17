## 1. Acceptance Artifact

- [ ] 1.1 Define a standard implementation acceptance artifact for interactive visual components.
- [ ] 1.2 Require design contract path, visual source path, student screenshot path, teacher screenshot path, non-default screenshot path, manifest audit path, test command output, and evidence sample path.
- [ ] 1.3 Fail validation when required artifact paths are missing, stale, or point to non-existent files.

## 2. Visual Gates

- [ ] 2.1 Gate light and dark theme coverage.
- [ ] 2.2 Gate student and teacher role coverage.
- [ ] 2.3 Gate non-default state coverage.
- [ ] 2.4 Gate engineering semantic leaks in titles, captions, fallbacks, diagnostics, and media frames.
- [ ] 2.5 Gate against `interactive-figure` as a generic visual or control carrier.

## 3. Component-Specific Gates

- [ ] 3.1 Gate derivation stage against vertical card-list fallback.
- [ ] 3.2 Gate derivation stage against missing KaTeX/LaTeX rendering.
- [ ] 3.3 Gate derivation stage against missing formula block reveal and color roles.
- [ ] 3.4 Gate block diagram and signal-flow graph against static-image-only interaction.
- [ ] 3.5 Gate annotated media against unrecorded hotspots.
- [ ] 3.6 Gate control workbench reuse against course-private duplicate panels.

## 4. Evidence Gates

- [ ] 4.1 Require backend evidence samples for each interactive visual component.
- [ ] 4.2 Require teacher diagnostics evidence for each evidence-producing component.
- [ ] 4.3 Ensure teacher diagnostics do not expose student answer inputs or internal ids as labels.

## 5. Review Gates

- [ ] 5.1 Require browser audit for both student and teacher roles.
- [ ] 5.2 Require independent visual review or Product Design QA for substantial visual changes.
- [ ] 5.3 Require subagent review for pedagogy, UI flow, data governance, and critical risk when a course implementation uses the new components.

## 6. Validation

- [ ] 6.1 Run `rtk openspec validate enforce-interactive-visual-component-gates --strict`.
- [ ] 6.2 Run visual gate tests and manifest audit tests.
- [ ] 6.3 Run browser audit in light and dark themes for student and teacher roles.
