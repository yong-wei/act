## 1. Baseline and Classification

- [x] 1.1 Re-run the owned-surface React Doctor error gate after `react-doctor-owned-surface-gates` is available.
- [x] 1.2 Filter diagnostics for resource, widget, simulation, and control-system paths and confirm the expected files and counts.
- [x] 1.3 Classify each finding as identity reset, derived display state, timer/subscription cleanup, mutable dependency, async envelope, or user-editable state before editing.

## 2. Implementation

- [x] 2.1 Fix `src/resources/interactive-learning/**` deck and Control Odyssey state/effect findings.
- [x] 2.2 Fix `src/resources/simulations/**` findings, including cleanup and ship model preview identity reset behavior.
- [x] 2.3 Fix `src/resources/widgets/**` findings in analogy, argument, and physics widgets.
- [x] 2.4 Fix the `src/resources/control-system/**` control analysis panel finding without changing chart semantics.
- [x] 2.5 Add focused tests or route/component smoke checks for high-risk resource and simulation behavior touched by the fixes.

Implementation evidence: knowledge decks now record visits in event handlers and publish progress from monotonic visit counts; Control Odyssey resets transient AI state from level-selection actions; simulation trails reset through keyed child components; Ten Drops handles completion after game actions instead of effect-based prop/state synchronization; resource widgets derive AI hints during render; root locus overlays re-render from existing handle dependencies.

## 3. Verification

- [x] 3.1 Run targeted tests or smoke checks for modified resources, widgets, simulations, and control-system panels.
- [x] 3.2 Run the owned-surface React Doctor error gate and confirm zero diagnostics under the resource paths covered by this change.
- [x] 3.3 Run any existing simulation/control tests affected by modified files.

Verification evidence:

- `npx tsc --noEmit --pretty false` passed.
- `npm run test:unit -- src/features/interactive/__tests__/resource-react-doctor-regression.test.ts src/features/interactive/__tests__/control-charts.test.tsx src/features/interactive/__tests__/control-analysis-core.test.ts` passed 3 files / 45 tests.
- `npm run test:unit -- src/resources/simulations/__tests__/simulation-replay-determinism.test.ts src/resources/simulations/__tests__/simulation-run-contract.test.ts src/resources/simulations/__tests__/cruise-telemetry-bridge.test.ts src/resources/simulations/__tests__/course-resource-config.test.ts` passed 4 files / 22 tests.
- `node ./scripts/tests/react-doctor-owned-surface-gate.mjs --mode=errors` passed with zero resource diagnostics.
- `npm run lint` passed.
- `npm run test` passed.
- `npm run build` passed with existing Turbopack/NFT broad trace warnings in `document-rubric-grading-workbench.ts` / `next.config.js`.
- `git diff --check` passed.
