## Why

AI SDK findings require a semver-major migration of `ai` and related `@ai-sdk/*` packages. The affected code includes streaming responses, tool definitions, provider wrappers, and chat clients, so this needs a dedicated change with runtime validation.

## What Changes

- Migrate `ai`, `@ai-sdk/openai`, and `@ai-sdk/react` to a supported major line that clears audit findings.
- Update server-side `streamText`, `generateText`, tool definitions, and response helpers to the new SDK contracts.
- Update client chat hook usage where needed.
- Preserve configured provider behavior and existing AI route response semantics.

## Capabilities

### New Capabilities
- `dependency-vulnerability-catalog`: Adds the AI SDK major-remediation requirement.

### Modified Capabilities
- None.

## Impact

- Affects `src/app/api/ai/**`, `src/app/api/simulation/**`, `src/lib/ai-client.ts`, `src/lib/ai/provider-registry.ts`, `src/lib/konling-agent-runtime.ts`, `src/lib/ai-tools.ts`, `src/types/ai-context.ts`, and client chat consumers.
- Affects package versions and possibly generated stream response formats.
- Must not be bundled with Next framework migration.
