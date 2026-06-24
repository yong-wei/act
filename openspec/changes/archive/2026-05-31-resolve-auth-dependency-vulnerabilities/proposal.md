## Why

The audit reports auth-related findings through `next-auth`, `@auth/prisma-adapter`, `@auth/core`, `cookie`, and `uuid`. These dependencies sit on login, session, and Prisma adapter boundaries, so they need their own migration instead of being bundled into generic updates.

## What Changes

- Determine the supported auth remediation path for the current Next baseline.
- Remove the unused Prisma adapter dependency and use a targeted `next-auth` transitive `uuid` override so cookie and UUID findings are resolved without moving to Auth.js beta APIs.
- Preserve credentials login, session shape, role fields, existing auth wiring, and route protection.
- Add targeted auth/session regression checks.

## Capabilities

### New Capabilities
- `dependency-vulnerability-catalog`: Adds the authentication dependency remediation requirement.

### Modified Capabilities
- None.

## Impact

- Affects auth dependency versions, session contract tests, and session-consuming route validation. Runtime inventory confirmed no `PrismaAdapter` wiring in `src/lib/auth.ts`, so Prisma auth models are not changed.
- May affect package versions and peer dependency constraints.
- Must be coordinated with Next major migration but should remain separately reviewable.
