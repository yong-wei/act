## 1. Candidate correction contract and derivation

- [x] 1.1 Define the read-only candidate correction proposal contract, including trigger, comparison, supporting facts, estimated remaining work, and unavailable reasons.
- [x] 1.2 Derive a deterministic proposal from persisted failed-checkpoint and deviation facts without mutating the path or execution state.
- [x] 1.3 Add focused unit coverage for feasible, unavailable, and no-material-difference derivation outcomes.

## 2. Journey API integration

- [x] 2.1 Extend the authorized journey projection with an inspectable correction action and correction proposal or unavailable reason.
- [x] 2.2 Add route-level regression coverage proving failed and deviation-triggered proposals remain read-only.

## 3. Student-visible proposal

- [x] 3.1 Render the candidate proposal and its original-versus-proposed remaining-path comparison in adaptive practice.
- [x] 3.2 Make unavailable reasons visible without presenting a fabricated or applied correction.
- [x] 3.3 Add UI regression coverage for available and unavailable correction states.

## 4. Verification

- [x] 4.1 Run targeted unit and route tests, typecheck, lint for modified files, and strict OpenSpec validation.
- [x] 4.2 Run the issue worktree locally and capture desktop and narrow-viewport browser evidence for the correction proposal.
- [ ] 4.3 Run git diff --check and record verification results in the pull request description.
