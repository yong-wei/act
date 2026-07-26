## 1. Regression Coverage

- [ ] 1.1 Add a component regression test that reproduces duplicate return and ready actions with the same normalized href.
- [ ] 1.2 Add coverage proving a genuine next-node action with a different href remains visible.
- [ ] 1.3 Audit every `AdaptivePathJourneyControlFromRoute` mount and assert path-context pages do not add an equivalent local return action.

## 2. Shared Journey Action Ownership

- [ ] 2.1 Implement shared normalized-target equivalence detection for journey actions.
- [ ] 2.2 Suppress projected ready, completion, or recovery actions when they duplicate the owned return action.
- [ ] 2.3 Preserve the resource-page local return action for non-path sources and suppress it for valid path launch contexts.

## 3. Verification

- [ ] 3.1 Run focused adaptive journey and resource-page tests.
- [ ] 3.2 Run TypeScript validation and OpenSpec strict validation.
- [ ] 3.3 Verify representative path-center, resource, interactive, workbench, and Arena routes in the browser or with equivalent DOM-level coverage, confirming at most one visible `返回学习路径` action per page.
