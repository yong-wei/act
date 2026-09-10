## Why

Runtime qualification currently records and revalidates a content-addressed application/Runtime compatibility receipt in addition to exercising the candidate through the running application. The receipt duplicates deployment identity data without proving that the current application can read the candidate, and its former revision coupling blocks harmless application releases.

## What Changes

- Remove the compatibility-receipt schema, immutable proof files, lifecycle projection fields, and related application-image and migration-set comparison gates.
- Keep one release-time compatibility condition: after the candidate view is selected for the newly deployed application, the application's readiness endpoint and existing in-container structured runtime, route, media, textbook, hybrid-index, and knowledge consumer smoke checks must pass.
- Preserve immutable Runtime manifest verification, read-only mounting, lifecycle locking, rollback, and the existing active Runtime identity; a consumer-smoke failure restores the previous Runtime and application state.
- Remove Git revision equality and application-source proxy checks from Runtime activation. `authoringRevision` remains provenance only.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-main-app-compatibility-proof`: Replace identity-receipt qualification with actual candidate consumption by the newly deployed application.
- `content-addressed-runtime-release-storage`: Select a materialized Runtime only after the actual consumer smoke succeeds; remove compatibility-proof receipt dependencies from selection and recovery.

## Impact

This changes the Runtime activation shell workflow, lifecycle and active-receipt projection, application Runtime receipt reader, deployment-contract tests, and Runtime OpenSpec requirements. It does not alter blob manifests, OSS publication, selection locking, graph authority composition, or public readiness output.
