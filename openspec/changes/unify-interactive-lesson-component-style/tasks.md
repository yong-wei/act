## 1. Shared Courseware Style Primitives

- [x] 1.1 Add shared courseware panel, stack, section, toolbar, title-level, body, caption, and control primitives in the global interactive lesson style layer.
- [x] 1.2 Make manifest runtime page title rendering use semantic level 1 heading markup and shared panel exterior markers.
- [x] 1.3 Make manifest module renderers use semantic level 2 headings, semantic level 3 in-module headings, shared body typography, and shared internal spacing primitives.
- [x] 1.4 Make standard module chrome metadata-only for modules that provide a courseware panel exterior, including visual, media, card, activity, compute, table, rich, and analytics modules.
- [x] 1.5 Produce a manifest-first runtime courseware module inventory and list any legacy non-manifest private pages as migration exceptions instead of acceptance coverage.

## 2. Runtime Layout Ownership

- [x] 2.1 Move sibling component vertical spacing into the shared manifest runtime layout stack.
- [x] 2.2 Remove or replace page-local spacing wrappers around all manifest-first shared-runtime courseware content and activity surfaces.
- [x] 2.3 Ensure component-internal spacing remains inside shared courseware primitives and does not alter sibling component gaps.
- [x] 2.4 Add a spacing scan that fails when manifest-first runtime pages, module renderers, or lesson-specific adapters use page-local outer `mt-*`, `mb-*`, `space-y-*`, or ad hoc wrapper gaps for sibling component spacing.

## 3. Governance and Tests

- [x] 3.1 Extend module visual standard tests to verify transparent metadata chrome and title-panel exterior parity.
- [x] 3.2 Add runtime renderer tests that assert semantic level 1, level 2, level 3, and body typography markers are present in representative content, visual, activity, and compute modules.
- [x] 3.3 Add or update tests that reject courseware body/title freeform font sizing and sibling spacing drift in shared manifest runtime source and output.
- [x] 3.4 Keep existing interactive visual gates passing for 1-2 block diagram, signal flow graph, derivation stage, annotated media, and compute panels.
- [x] 3.5 Add or update governance tests so freeform `text-*` font-size choices are allowed only in shared primitive definitions or explicit caption/control exceptions.

## 4. Acceptance and Review

- [x] 4.1 Run OpenSpec strict validation for this change.
- [x] 4.2 Run manifest-first module inventory and manifest audit for lesson 1-2.
- [x] 4.3 Run targeted unit tests covering interactive module registry, commercial module chrome, 1-2 course runtime, manifest renderer behavior, typography semantics, and spacing governance.
- [x] 4.4 Capture or refresh traceable browser evidence for 1-2 student and teacher routes across light/dark themes, desktop/mobile/projection viewports, and representative title, figure, derivation, block diagram, signal flow graph, activity, table/rich, and compute states.
- [x] 4.5 Run subagent review for proposal artifacts before the proposal commit, and fix any blocking findings.
- [x] 4.6 Run subagent review after implementation and fix any blocking findings before final implementation commit and push.
