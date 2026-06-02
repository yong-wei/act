## 1. Inventory

- [x] 1.1 List auth routes, session helpers, type augmentations, and representative session consumers.
- [x] 1.2 Confirm the supported remediation path for `next-auth`, `@auth/prisma-adapter`, `@auth/core`, `cookie`, and `uuid`.

## 2. Migration

- [x] 2.1 Update auth dependencies without accepting audit-suggested downgrades that break the app line.
- [x] 2.2 Adjust auth configuration, adapter wiring, and session callbacks only where required.
- [x] 2.3 Preserve role, ID, and custom session fields.

## 3. Validation

- [x] 3.1 Run targeted auth/session tests or smoke checks.
- [x] 3.2 Run representative protected-route checks.
- [x] 3.3 Run `rtk npm audit --json` and document remaining auth-related findings.
- [x] 3.4 Validate with `rtk openspec validate resolve-auth-dependency-vulnerabilities --strict`.
