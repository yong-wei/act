## 1. Task-derived companion context

- [x] 1.1 Add a shared Arena task and method resolver that exposes registered parameter metadata, metric definitions, and aggregate learning guidance.
- [x] 1.2 Add failing resolver tests for PID compatibility, MPC metrics, black-box metrics, and unsupported task-method combinations.

## 2. Context-aware intervention guidance

- [x] 2.1 Add failing intervention-engine tests showing context-specific constraint detection and MPC/black-box advisory language.
- [x] 2.2 Implement optional companion-context handling while preserving the no-context legacy behavior.
- [x] 2.3 Pass the resolved context through governed Konling intervention creation without adding official-result or learning-record writes.

## 3. Authenticated Arena companion request and panel

- [x] 3.1 Add failing route-contract tests for server-side task-method validation and context forwarding.
- [x] 3.2 Resolve Arena context in the authenticated generate route and reject invalid task-method pairs before record creation.
- [x] 3.3 Refactor the companion panel to render method-specific parameters and metrics from the shared resolver.

## 4. Verification and specification synchronization

- [x] 4.1 Run focused unit and route-contract tests, related Konling regression tests, TypeScript typecheck, and `git diff --check`.
- [x] 4.2 Run strict OpenSpec validation, sync delta specifications into main specs, and record the post-merge archive responsibility. Archive this change with `openspec archive adapt-ai-companion-for-multiple-control-methods` after its PR is merged into `integration`.

## 5. Review remediation

- [x] 5.1 Add failing runtime tests proving that a cooldown applies to the same Arena task-method identity but not another allowed method, then persist the resolved task-method reference with the intervention.
- [ ] 5.2 Capture fail-closed Control Workbench browser evidence for representative PID, MPC, and black-box contexts at 1440px and 320px, including method switching, keyboard focus, requests, and overflow checks.
- [ ] 5.3 Reconcile the PR with the latest `integration` baseline and rerun the remediation verification suite.
