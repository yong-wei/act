## 1. Inventory

- [ ] 1.1 List all imports from `ai`, `ai/react`, `@ai-sdk/openai`, and `@ai-sdk/react`.
- [ ] 1.2 Map old SDK APIs to the target major-version APIs.

## 2. Migration

- [ ] 2.1 Update AI SDK package versions.
- [ ] 2.2 Update provider wrappers and configured model resolution.
- [ ] 2.3 Update server routes that call `streamText`, `generateText`, tools, and response helpers.
- [ ] 2.4 Update client chat hooks and message types where required.

## 3. Validation

- [ ] 3.1 Run targeted AI route and tool-call smoke checks.
- [ ] 3.2 Run `rtk npm run test:unit`.
- [ ] 3.3 Run `rtk npm run build` if route or streaming contracts changed broadly.
- [ ] 3.4 Run `rtk npm audit --json` and confirm AI SDK findings are resolved.
- [ ] 3.5 Validate with `rtk openspec validate migrate-ai-sdk-major-version --strict`.
