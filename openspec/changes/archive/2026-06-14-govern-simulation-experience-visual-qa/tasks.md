## 1. Evidence Matrix

- [x] 1.1 Define required routes: `/simulations`, final `/virtual-lab` behavior, `/simulations/destroyer`, DP representative, `/simulations/cruise`, and `/interactive-learning/control-workbench`.
- [x] 1.2 Define required states: desktop expanded navigation, desktop collapsed navigation, mobile, light theme, dark theme, dock collapsed, dock expanded, and local panels collapsed/expanded where applicable.
- [x] 1.3 Define evidence metadata for route, archetype, theme, viewport, auth/role, navigation state, dock state, local-tool state, scene visibility, and result.

## 2. Governance Checks

- [x] 2.1 Add checks that `/virtual-lab` does not report conflicting availability state.
- [x] 2.2 Add checks that student catalog surfaces do not show internal model deployment status as primary information.
- [x] 2.3 Add checks for duplicate Konling entries and dock/local-control collisions.
- [x] 2.4 Add route inventory checks for simulation catalog, model-library compatibility, and detail routes.

## 3. Visual And Runtime Acceptance

- [x] 3.1 Capture representative light/dark screenshots and 320px mobile screenshots.
- [x] 3.2 Verify nonblank primary scene or instrument area for representative simulation pages.
- [x] 3.3 Run local accessibility checks for form labels, icon labels, focus, and text fit.
- [x] 3.4 Run local React Doctor error-level checks for affected routes where feasible without GitHub Actions.

## 4. Final Gate

- [x] 4.1 Document temporary exceptions with owner and removal condition.
- [x] 4.2 Verify Control Workbench does not regress after simulation route changes.
- [x] 4.3 Run `rtk openspec validate govern-simulation-experience-visual-qa --strict`.
- [x] 4.4 Verify the final QA evidence records `align-virtual-simulation-product-design-handoff` as the handoff-aligned design prerequisite.
