# React Doctor Resource Simulation Warning Classification (#495)

Generated from `artifacts/react-doctor/classify-resource-simulation-react-doctor-warnings-495/owned-warnings.json`.

## Scope

This report classifies resource and simulation React Doctor warnings before remediation. The selected R3F/Three batch is `no-unknown-property` under `src/resources/simulations/**`. It does not change simulation scene JSX, numerical models, metrics, clocks, scenarios, controllers, or physics semantics.

## Totals

| Metric | Count |
| --- | ---: |
| Current raw diagnostics | 2641 |
| Current owned diagnostics | 2641 |
| Resource diagnostics | 872 |
| Simulation diagnostics | 431 |
| R3F/Three `no-unknown-property` diagnostics | 186 |
| DOM-risk `no-unknown-property` files | 0 |
| Resource product-risk diagnostics | 40 |

## Remediated Findings

| File | Rule | Change |
| --- | --- | --- |
| `src/resources/interactive-learning/lesson-02-legacy/phases/pretest-phase.tsx` | no-gray-on-colored-background | Use black text on amber button background and raise disabled button text contrast. |
| `src/resources/interactive-learning/physics-modeling/teaching-phases/intro-phase.tsx` | no-gray-on-colored-background | Use black text on amber button background. |

## Advisory Buckets

| Bucket | Count | Rules |
| --- | ---: | --- |
| product-risk | 260 | nextjs-no-use-search-params-without-suspense: 32<br>no-pass-data-to-parent: 228 |
| mechanical-cleanup | 707 | nextjs-missing-metadata: 177<br>only-export-components: 78<br>unused-file: 68<br>unused-export: 384 |
| tool-noise | 186 | no-unknown-property: 186 |
| deferred | 1488 | server-sequential-independent-await: 64<br>no-giant-component: 70<br>nextjs-no-client-side-redirect: 5<br>jsx-no-jsx-as-prop: 11<br>prefer-module-scope-static-value: 64<br>nextjs-no-redirect-in-try-catch: 3<br>no-array-index-as-key: 54<br>no-inline-bounce-easing: 9<br>prefer-useReducer: 76<br>no-chain-state-updates: 20<br>no-autofocus: 2<br>async-parallel: 8<br>rerender-state-only-in-handlers: 62<br>async-await-in-loop: 1<br>no-cascading-set-state: 14<br>js-combine-iterations: 73<br>prefer-dynamic-import: 7<br>rendering-hydration-mismatch-time: 11<br>no-usememo-simple-expression: 8<br>rerender-lazy-state-init: 9<br>nextjs-no-client-fetch-for-server-data: 4<br>no-fetch-in-effect: 23<br>no-gray-on-colored-background: 8<br>js-hoist-intl: 4<br>no-derived-state: 67<br>no-event-handler: 136<br>no-initialize-state: 21<br>nextjs-no-native-script: 1<br>no-render-in-render: 179<br>prefer-tag-over-role: 20<br>nextjs-no-img-element: 6<br>exhaustive-deps: 10<br>async-defer-await: 4<br>no-multi-comp: 24<br>no-react19-deprecated-apis: 23<br>heading-has-content: 1<br>prefer-use-effect-event: 17<br>rendering-hydration-no-flicker: 11<br>no-effect-chain: 5<br>rerender-memo-with-default-value: 24<br>no-prop-callback-in-effect: 61<br>rerender-memo-before-early-return: 1<br>no-derived-useState: 6<br>js-min-max-loop: 3<br>no-reset-all-state-on-prop-change: 7<br>prefer-html-dialog: 2<br>prefer-module-scope-pure-function: 31<br>advanced-event-handler-refs: 2<br>js-flatmap-filter: 77<br>client-passive-event-listeners: 3<br>no-derived-state-effect: 16<br>nextjs-image-missing-sizes: 6<br>js-set-map-lookups: 2<br>no-polymorphic-children: 1<br>rerender-lazy-ref-init: 35<br>no-effect-event-handler: 2<br>js-length-check-first: 1<br>no-pass-live-state-to-parent: 60<br>no-mirror-prop-effect: 1<br>rerender-functional-setstate: 2<br>no-noninteractive-element-interactions: 1<br>js-cache-property-access: 1<br>rendering-usetransition-loading: 1<br>no-many-boolean-props: 1<br>no-inline-exhaustive-style: 1<br>unused-dependency: 2<br>circular-dependency: 3 |

## R3F/Three Classification

Classification: `scanner-noise-candidate`

Owner: `#495 react-doctor-warning-remediation`

Removal condition: remove or reclassify this exception when React Doctor distinguishes R3F intrinsics from DOM unknown-property, when any candidate file moves outside `src/resources/simulations/**`, or when representative route evidence shows a console/runtime/nonblank failure.

Rationale: all current `no-unknown-property` diagnostics are in R3F/Three simulation files and `domRiskFiles` is empty. Rewriting valid R3F JSX would risk scene semantics without fixing a confirmed runtime defect.

| Candidate file | Count |
| --- | ---: |
| `src/resources/simulations/components/model-loading-placeholder.tsx` | 5 |
| `src/resources/simulations/destroyer-simulation.tsx` | 27 |
| `src/resources/simulations/environment/procedural-clouds.tsx` | 4 |
| `src/resources/simulations/environment/sky-dome.tsx` | 3 |
| `src/resources/simulations/environment/wave-water.tsx` | 8 |
| `src/resources/simulations/ship-model-preview.tsx` | 7 |
| `src/resources/simulations/simulations/container-simulation.tsx` | 11 |
| `src/resources/simulations/simulations/cruise-simulation.tsx` | 11 |
| `src/resources/simulations/simulations/destroyer-simulation.tsx` | 21 |
| `src/resources/simulations/simulations/dredger-simulation.tsx` | 24 |
| `src/resources/simulations/simulations/drilling-simulation.tsx` | 36 |
| `src/resources/simulations/simulations/icebreaker-simulation.tsx` | 18 |
| `src/resources/simulations/simulations/lng-simulation.tsx` | 11 |

## Representative Runtime Evidence

The classification is paired with the existing virtual simulation visual QA manifest: `artifacts/commercial-ui/simulation-experience-visual-qa/manifest.json`. The shared React Doctor error gate report is `artifacts/commercial-ui/simulation-experience-visual-qa/react-doctor-owned-errors.json` and has 0 selected diagnostics.

| Route | Archetype | Passed viewports | Selected error diagnostics |
| --- | --- | ---: | ---: |
| `/simulations` | catalog | 6 | 0 |
| `/virtual-lab` | legacy-redirect | 6 | 0 |
| `/simulations/destroyer` | heading-control | 24 | 0 |
| `/simulations/drilling` | dp-positioning | 24 | 0 |
| `/simulations/cruise` | cruise-roll | 24 | 0 |
| `/interactive-learning/control-workbench` | control-workbench-regression | 6 | 0 |

## Real Resource Remediation Classification

The current resource product-risk warnings are not `no-unknown-property` scanner noise. They are tracked as follow-up remediation rather than folded into this R3F classification change.

| Rule | Count |
| --- | ---: |
| no-pass-data-to-parent | 40 |

Resource accessibility warnings in `src/resources/**`: 6.

Resource state/effect warnings in the tracked family: 163.

## Validation Notes

- Two low-risk resource contrast findings were remediated.
- No R3F scene JSX was rewritten.
- No model, metric, clock, scenario, controller, or physics semantics were touched, so numerical regression is not required for this change.
- The R3F allowlist is backed by route visual/nonblank evidence and a zero-selected-diagnostic React Doctor error gate.
