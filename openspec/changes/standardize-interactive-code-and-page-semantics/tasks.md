## 1. Standard Code Module

- [ ] 1.1 Add `content.code` to the canonical module taxonomy, alias/gate metadata, and standard module documentation.
- [ ] 1.2 Implement a shared manifest runtime renderer for `content.code` with MATLAB syntax highlighting and accessible teaching labels.
- [ ] 1.3 Add unit coverage proving `content.code` is registry-backed, content-only, and rendered with MATLAB highlighting.

## 2. Unit 1-1 Course Content

- [ ] 2.1 Locate Unit 1-1 p5 and every figure/media-bearing page that exposes development paths, file paths, platform notes, module names, or generic carrier labels.
- [ ] 2.2 Replace those visible strings in authoring/runtime sources with teaching-semantic titles, captions, explanations, or remove redundant text.
- [ ] 2.3 Convert Unit 1-1 p12 code content to MATLAB-form source and represent it as a `content.code` module.
- [ ] 2.4 Regenerate or update Unit 1-1 runtime artifacts and confirm the route implementation consumes the corrected manifest/content.

## 3. No-Interaction Status Gate

- [ ] 3.1 Add the no-interaction status gate to `npm run test:course-data-quality-gates` so the unified course data-quality command fails when a non-interactive manifest page declares or renders a generic page interaction status module.
- [ ] 3.2 Cover Unit 1-1 no-interaction pages in the gate and add a failing fixture or assertion that proves the gate catches the forbidden status module.

## 4. Skill and Authoring Guidance

- [ ] 4.1 Update `interactive-design` guidance and tests to list `content.code` as a standard module and require code payloads instead of rich-text code blocks.
- [ ] 4.2 Update `interactive-lesson` guidance and references to require shared code rendering and prohibit course-private code display components.

## 5. Validation and Review

- [ ] 5.1 Run Unit 1-1 content review/export checks and manifest audit.
- [ ] 5.2 Run standard module taxonomy/registry tests and the no-interaction status gate.
- [ ] 5.3 Run targeted Unit 1-1 tests plus relevant lint/type checks for touched files.
- [ ] 5.4 Run subagent spec-compliance and code-quality review; fix every actionable finding and rerun affected checks.
- [ ] 5.5 Validate and archive the OpenSpec change after implementation, then run affected spec validation.
