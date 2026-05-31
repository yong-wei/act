## 1. Inventory

- [ ] 1.1 List auth routes, session helpers, type augmentations, and representative session consumers.
- [ ] 1.2 Confirm the supported remediation path for `next-auth`, `@auth/prisma-adapter`, `@auth/core`, `cookie`, and `uuid`.

## 2. Migration

- [ ] 2.1 Update auth dependencies without accepting audit-suggested downgrades that break the app line.
- [ ] 2.2 Adjust auth configuration, adapter wiring, and session callbacks only where required.
- [ ] 2.3 Preserve role, ID, and custom session fields.

## 3. Validation

- [ ] 3.1 Run targeted auth/session tests or smoke checks.
- [ ] 3.2 Run representative protected-route checks.
- [ ] 3.3 Run `rtk npm audit --json` and document remaining auth-related findings.
- [ ] 3.4 Validate with `rtk openspec validate resolve-auth-dependency-vulnerabilities --strict`.
