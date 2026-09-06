## Why

Recent Konling migrations and fixes are complete, but `konling-agent-runtime.ts` remains a 426 KB coordinator. The next pass should keep one runtime coordinator while removing logic that now belongs to established domain APIs or is repeated inside the coordinator.

## What Changes

- Characterize the current tool, context, citation, permission, session, and persistence behavior before editing.
- Keep one application coordinator and use existing domain public APIs for domain decisions.
- Consolidate repeated tool metadata, context projection, citation handling, and run-state plumbing where behavior is identical.
- Delete obsolete compatibility branches and forwarding helpers only after zero-use proof.
- Preserve every permission, approval, idempotency, privacy, citation, and student-safe failure contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `konling-agent-runtime`: require post-migration simplification to reduce direct cross-domain orchestration without changing public behavior or authority.

## Impact

- Primary code: `src/lib/konling-agent-runtime.ts` and its existing characterization tests.
- No model-provider change, new framework, public API expansion, database migration, or product redesign.
