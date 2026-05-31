## Context

The current project uses `next-auth@4`, `@auth/prisma-adapter@1`, and custom session typing. Audit remediation may require either a safe compatible update path or a controlled Auth.js migration. Because auth controls role and identity, the change needs behavior tests before and after dependency updates.

## Migration Strategy

- Inventory all auth entry points and session consumers before choosing package versions.
- Prefer the smallest supported dependency path that clears the audit findings.
- If the supported path requires Auth.js-era changes, isolate adapter and session callback changes in this issue and keep Next framework upgrades out of scope.
- Preserve existing user roles, IDs, and session fields.

## Test Strategy

- Credentials login success and failure.
- Server session retrieval in representative API routes.
- Client `useSession` consumer smoke check if behavior changes.
- Prisma adapter compatibility with existing schema.

## Risks

- npm audit may suggest a downgrade-like `next-auth` version. That must not be accepted blindly if it regresses the application line.
- Adapter major upgrades can alter expected schema or session callback behavior.
- Cookie behavior changes can affect deployment sessions.

## Verification

- Run targeted auth tests or smoke scripts.
- Run `rtk npm audit --json` and confirm auth findings are resolved or explicitly deferred to the Next migration when unavoidable.
- Validate with `rtk openspec validate resolve-auth-dependency-vulnerabilities --strict`.
