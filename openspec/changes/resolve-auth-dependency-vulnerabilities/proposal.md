## Why

The audit reports auth-related findings through `next-auth`, `@auth/prisma-adapter`, `@auth/core`, `cookie`, and `uuid`. These dependencies sit on login, session, and Prisma adapter boundaries, so they need their own migration instead of being bundled into generic updates.

## What Changes

- Determine the supported auth remediation path for the current Next baseline.
- Upgrade or replace auth dependencies so cookie and UUID findings are resolved.
- Preserve credentials login, session shape, role fields, Prisma adapter behavior, and route protection.
- Add targeted auth/session regression checks.

## Capabilities

### New Capabilities
- `dependency-vulnerability-catalog`: Adds the authentication dependency remediation requirement.

### Modified Capabilities
- None.

## Impact

- Affects `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/types/next-auth.d.ts`, Prisma auth models if adapter requirements change, and session-consuming routes/components.
- May affect package versions and peer dependency constraints.
- Must be coordinated with Next major migration but should remain separately reviewable.
