## 1. Brand Kit

- [ ] 1.1 Define app mark, horizontal lockup, compact mark, favicon, route badge, Arena badge, course badge, workbench chrome, data snapshot, governance snapshot, and report watermark usage.
- [ ] 1.2 Add or register brand assets and document their light/dark behavior.
- [ ] 1.3 Define icon family, stroke, optical size, numeric typography, and texture rules.
- [ ] 1.4 Define typography, numeric readout, status label, evidence label, report watermark, graph chrome, and workspace chrome rules that are distinct from generic developer-tool UI.

## 2. Dual Templates

- [ ] 2.1 Implement or register light template token roles for engineering paper, matte surfaces, traces, stamps, and focus states.
- [ ] 2.2 Implement or register dark template token roles for night canvas, instrument panels, trace illumination, and signal states.
- [ ] 2.3 Map or retire `interactive-course-hub-*`, `admin-console-*`, `premium-lesson-*`, and `surface-card` namespaces where they conflict.
- [ ] 2.4 Reject representative-route additions of raw `slate`, `cyan`, `amber`, `violet`, `fuchsia`, or similar page-local accent classes unless mapped to governed brand token roles.
- [ ] 2.5 Verify light and dark templates are independent commercial templates, not only color-inverted variants of the same card system.

## 3. Verification

- [ ] 3.1 Add focused token/brand contract tests.
- [ ] 3.2 Capture representative light/dark brand application evidence.
- [ ] 3.3 Capture evidence for brand application on navigation, learner record, mission workspace, knowledge/data map, operations console, and report surfaces.
- [ ] 3.4 Run `rtk openspec validate create-dual-theme-brand-tokens-and-assets --strict`.
