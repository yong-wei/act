## 1. Path Bundle Contract

- [x] 1.1 Define the control-correction three-style path bundle payload.
- [x] 1.2 Map foundation remediation, Arena/simulation sprint, and preference-matched route to explicit planner policy families.
- [x] 1.3 Require each option to include target deficits, evidence basis, resource mix, overlap, effort, terminal validation strategy, and limitations.

## 2. Planning and Selection

- [x] 2.1 Generate path bundles from diagnosis report snapshots and learner-state slices.
- [x] 2.2 Validate meaningful distinction and return low-resource fallback when options are not distinct.
- [x] 2.3 Record student selection, rejection, switch, completion, deviation, and helpfulness events.
- [x] 2.4 Feed selection and outcome evidence into learner preference and strategy features without changing mastery directly.

## 3. Konling and Diagnosis Integration

- [x] 3.1 Let Konling path-advisor explain differences using citations and diagnosis evidence.
- [x] 3.2 Let diagnosis surfaces display path options and selection history.
- [x] 3.3 Preserve privacy and citation requirements for teacher-visible path rationale.

## 4. Verification

- [x] 4.1 Add planner tests for distinct path options and fallback state.
- [x] 4.2 Add evidence writeback tests for selection and execution outcomes.
- [x] 4.3 Add learner-state tests that choice affects preference but not mastery.
- [x] 4.4 Run `rtk openspec validate three-style-learning-path-loop --strict`.
