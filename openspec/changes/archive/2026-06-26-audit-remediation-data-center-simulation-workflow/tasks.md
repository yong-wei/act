## 1. Data Center

- [x] 1.1 Define Data Center role/source boundary states for student, teacher, and admin users.
- [x] 1.2 Add explicit student redirection reasons and teacher/admin source quality states.
- [x] 1.3 Define export snapshot scope, source table families, source windows, source quality, requester role, and redaction policy.
- [x] 1.4 Ensure export actions are reachable despite floating controls and expose completion/failure status.
- [x] 1.5 Preserve origin route and target scope for governance handoffs.

## 2. Simulation Workflows

- [x] 2.1 Make shell-declared bottom tools visible or explicitly unsupported with a recovery reason.
- [x] 2.2 Preserve mission/task title, objective, completion criteria, return target, and save-back target in simulation routes.
- [x] 2.3 Add simulation directory filter status, empty recovery actions, and `/virtual-lab` compatibility explanation.
- [x] 2.4 Add completion states for saved, queued, unsupported, and failed simulation task outcomes.
- [x] 2.5 Update audit evidence with data-center and simulation finding ids.

## 3. Verification

- [x] 3.1 Add route or unit tests for Data Center source/export redaction states and simulation task context.
- [x] 3.2 Capture browser evidence for Data Center export reachability and representative simulation mission flow.
- [x] 3.3 Run `rtk openspec validate audit-remediation-data-center-simulation-workflow --strict`.
