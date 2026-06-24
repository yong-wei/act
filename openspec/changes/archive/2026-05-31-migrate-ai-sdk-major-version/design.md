## Context

The project uses AI SDK v3-era APIs such as `streamText`, `generateText`, `tool`, `StreamingTextResponse`, `convertToCoreMessages`, and `useChat`-related types. Audit remediation points to a current major line, which can change request, response, and tool-call contracts.

## Migration Strategy

- Inventory all imports from `ai`, `ai/react`, `@ai-sdk/openai`, and `@ai-sdk/react`.
- Update provider construction while preserving configured provider selection and model settings.
- Update server routes before client chat surfaces so response formats remain deliberate.
- Replace deprecated helpers with current SDK equivalents.
- Keep prompt content, learning evidence rules, and AI safety boundaries unchanged unless required by SDK API changes.

## Validation Scope

- Typecheck or build-level validation for all AI imports.
- Targeted route checks for `/api/ai/chat`, `/api/ai/sessions/[id]/messages`, AI settings test, and simulation insight endpoints.
- Tool-call smoke check for the Konling runtime if tools are affected.

## Risks

- Streaming protocol changes can break client chat rendering without compile errors.
- Tool parameter schemas may need explicit schema updates.
- Provider-wrapper changes can silently alter configured model resolution.

## Verification

- Run targeted AI route tests or smoke checks.
- Run `rtk npm run test:unit` for affected tests.
- Run `rtk npm run build` if the change touches streaming/runtime contracts broadly.
- Validate with `rtk openspec validate migrate-ai-sdk-major-version --strict`.
