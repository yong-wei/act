## 1. Design Source Audit

- [ ] 1.1 Read `artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md` and extract the adopted, rejected, and merged visual decisions into an implementation matrix.
- [ ] 1.2 Inspect the three concept images referenced by the handoff and map each accepted visual requirement to the affected virtual simulation routes.
- [ ] 1.3 Identify every existing virtual simulation catalog, detail, Konling, and embedded course entry point that must align with the handoff.
- [ ] 1.4 Record explicit exclusions so implementation does not reintroduce rejected Product Design elements such as model deployment status, role switching, duplicate assistant surfaces, or pixel-perfect concept copying.
- [ ] 1.5 Choose and document the handoff-approved `/virtual-lab` compatibility role: redirect, model-library subpage, or compatibility entry fully reusing `/simulations`.

## 2. Catalog Alignment

- [ ] 2.1 Rework the virtual simulation laboratory/catalog page so its layout, navigation continuity, filtering, grouping, and browsing controls follow the handoff's Concept 1 adoption notes.
- [ ] 2.2 Replace non-teaching or implementation-facing status copy with learning, experiment, course, task, or resource semantics.
- [ ] 2.3 Verify `/simulations` and the selected `/virtual-lab` compatibility behavior do not conflict in status, counts, task state, availability, launch action, or entry semantics.
- [ ] 2.4 Verify desktop and mobile catalog screenshots against the handoff and concept image before marking the catalog complete.

## 3. Simulation Shell Alignment

- [ ] 3.1 Rework the shared simulation detail shell so the live simulation canvas is the dominant visual layer and supporting controls appear as translucent command surfaces around it.
- [ ] 3.2 Implement collapsible edge panels, restore handles, and bottom-edge tool controls in the shell without hiding required task context.
- [ ] 3.3 Ensure collapse controls and restore handles are keyboard reachable, visibly focused, and labeled clearly.
- [ ] 3.4 Apply the shell consistently to relevant virtual simulation detail pages, including Konling pages and course-embedded resource views where applicable.
- [ ] 3.5 Verify desktop and mobile detail screenshots against the handoff and Concept 2 command-deck reference before marking the shell complete.

## 4. Learning Mission Semantics

- [ ] 4.1 Introduce the accepted Concept 3 mission semantics: current objective, task chain, evidence or submission state, and next learning action.
- [ ] 4.2 Keep mission surfaces visually integrated with the shared simulation shell instead of creating a separate role-based studio or assistant workspace.
- [ ] 4.3 Use `/interactive-learning/control-workbench` or a course-embedded simulation resource as the Concept 3 acceptance sample and verify both available-data and missing-data behavior.
- [ ] 4.4 Verify that all student-visible text remains teaching-facing and no platform-development wording is visible.

## 5. Visual Verification Gate

- [ ] 5.1 Capture desktop and mobile evidence for the catalog, `/virtual-lab` compatibility behavior, representative simulation detail pages, and the Concept 3 acceptance sample in both supported themes.
- [ ] 5.2 Run an independent visual verification subagent with the handoff, concept images, implemented screenshots, and changed files as required inputs.
- [ ] 5.3 Treat any subagent finding that contradicts the handoff's adopted/rejected/merged decisions as blocking and fix it before completion.
- [ ] 5.4 Re-run the visual verification subagent after blocking fixes until it reports no blocking findings.

## 6. Governance And Handoff

- [ ] 6.1 Update implementation evidence or governance checks so final visual QA depends on this handoff-alignment change rather than validating the earlier incomplete baseline.
- [ ] 6.2 Run `openspec validate align-virtual-simulation-product-design-handoff --strict`.
- [ ] 6.3 Run the smallest sufficient UI, lint, and test checks for the files touched by implementation.
- [ ] 6.4 Document the screenshots, verification result, and residual risk in the implementation handoff before requesting final review.
