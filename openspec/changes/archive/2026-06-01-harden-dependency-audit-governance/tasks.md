## 1. Policy

- [x] 1.1 Define severity thresholds and runtime/dev dependency treatment.
- [x] 1.2 Define allowlist fields, expiry/removal rules, and owner issue requirements.
- [x] 1.3 Define how new findings fail the gate.

## 2. Implementation

- [x] 2.1 Add or update audit reporting script and package command.
- [x] 2.2 Add initial allowlist only for approved residual findings after remediation changes.
- [x] 2.3 Add CI or documented local verification according to project constraints.

## 3. Validation

- [x] 3.1 Run audit governance against the final migration lockfile.
- [x] 3.2 Verify new unallowlisted high or moderate findings fail according to policy.
- [x] 3.3 Validate with `rtk openspec validate harden-dependency-audit-governance --strict`.
