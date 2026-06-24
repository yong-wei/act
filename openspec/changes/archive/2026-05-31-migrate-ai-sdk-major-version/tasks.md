## 1. Inventory

- [x] 1.1 List all imports from `ai`, `ai/react`, `@ai-sdk/openai`, and `@ai-sdk/react`.
- [x] 1.2 Map old SDK APIs to the target major-version APIs.

## 2. Migration

- [x] 2.1 Update AI SDK package versions.
- [x] 2.2 Update provider wrappers and configured model resolution.
- [x] 2.3 Update server routes that call `streamText`, `generateText`, tools, and response helpers.
- [x] 2.4 Update client chat hooks and message types where required.

## 3. Validation

- [x] 3.1 Run targeted AI route and tool-call smoke checks.
- [x] 3.2 Run `rtk npm run test:unit`.
- [x] 3.3 Run `rtk npm run build` if route or streaming contracts changed broadly.
- [x] 3.4 Run `rtk npm audit --json` and confirm AI SDK findings are resolved.
- [x] 3.5 Validate with `rtk openspec validate migrate-ai-sdk-major-version --strict`.
