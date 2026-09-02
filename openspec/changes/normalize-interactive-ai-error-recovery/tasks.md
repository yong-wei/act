## 1. Reproduce the bypass

- [ ] 1.1 Add a hook regression for generic non-2xx and network failures that records the current raw message path.
- [ ] 1.2 Add a component regression proving an interactive panel does not render a status code, JSON body, provider detail or English browser error.

## 2. Normalize the interactive boundary

- [ ] 2.1 Route `useInteractiveAI` HTTP and network failures through the shared student-safe failure contract.
- [ ] 2.2 Preserve session-isolation and recovery-unavailable semantics and map them to the existing interactive recovery state.
- [ ] 2.3 Render only safe copy and a matching recovery action from `InteractiveAIPanel`.

## 3. Verify the student workflow

- [ ] 3.1 Add a real interactive-course browser regression for failure copy, recovery action, focus and 320px layout.
- [ ] 3.2 Prove successful streaming replies and recovered history remain unchanged.
- [ ] 3.3 Run focused tests, related Konling/interactive tests, typecheck, strict OpenSpec validation and `git diff --check`.
