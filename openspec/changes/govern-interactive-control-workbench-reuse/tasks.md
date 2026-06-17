## 1. Capability Registry

- [ ] 1.1 Register `control-workbench`, `control-linked-comparison`, `control-root-locus-design-map`, `control-frequency-reading-workbench`, `nonlinear-analysis-workbench`, and `training-workbench` as shared compute/workbench capabilities.
- [ ] 1.2 Route course manifest `compute.panel` declarations for these capabilities through shared control workbench or shared panel code.
- [ ] 1.3 Add validation errors for unregistered control compute capability references.

## 2. Reuse Gates

- [ ] 2.1 Add a gate that rejects new or migrated lessons using `interactive-figure` as a generic control-analysis carrier.
- [ ] 2.2 Add a gate that rejects course-private time-domain, frequency-domain, root-locus, Nyquist, performance, Rust/WASM request, or fallback panel implementations under `src/features/interactive/unit-*`.
- [ ] 2.3 Allow documented migration exceptions only when the issue id, owner, removal condition, and expiry are present.

## 3. Evidence And Diagnostics

- [ ] 3.1 Record student parameter changes, visible panel ids, compute capability id, selected design state, and submission payload through the shared interactive evidence path.
- [ ] 3.2 Surface teacher diagnostics for parameter exploration coverage, submitted judgments, release state, and unsupported/fallback states.
- [ ] 3.3 Ensure visible UI text does not expose Rust, WASM, renderer names, payload keys, file paths, or internal capability names to students.

## 4. Visual QA

- [ ] 4.1 Capture student and teacher screenshots in light and dark themes.
- [ ] 4.2 Capture at least one non-default state screenshot.
- [ ] 4.3 Save screenshot paths and visual source paths in the implementation acceptance artifact.
- [ ] 4.4 Run browser audit for both student and teacher roles.

## 5. Validation

- [ ] 5.1 Run `rtk openspec validate govern-interactive-control-workbench-reuse --strict`.
- [ ] 5.2 Run relevant unit gates for interactive module taxonomy and registry.
- [ ] 5.3 Run a manifest audit against at least one lesson using a shared control capability.
