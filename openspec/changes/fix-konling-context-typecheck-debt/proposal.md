## Why

`tsc --noEmit` reports 21 errors in Konling context and runtime tests. The failures are mostly stale tool-output typing, page/context enum drift, graph-node context key drift, and old learner-state fixtures. Konling is central to current RAG, graph, and path-planning validation, so this debt should be isolated from other typecheck work.

## What Changes

- Type Konling tool-result assertions instead of reading `unknown` outputs directly.
- Update Konling page/context keys and knowledge-type fixtures to current contracts.
- Refresh learner-state fixtures used by Konling tests without weakening personalization or citation semantics.

## Impact

- Targets 21 current TypeScript errors in 2 Konling test files.
- Does not change model prompts, provider config, or production answer behavior unless a type contract is genuinely wrong.
