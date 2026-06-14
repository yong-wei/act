## 1. Dock Registration

- [ ] 1.1 Inventory Konling launchers, assistant panels, and right-bottom fixed controls on `/knowledge`.
- [ ] 1.2 Register `/knowledge` with the shared floating dock model.
- [ ] 1.3 Remove or adapt any duplicate page-local assistant entry.
- [ ] 1.4 Verify dock collapsed and expanded states do not overlap local graph tools or the selected-node inspector.

## 2. Knowledge Context

- [ ] 2.1 Define the knowledge assistant context payload for route, selected node, relation summaries, active filters, density mode, view mode, and available learning actions.
- [ ] 2.2 Update context when selected node or explicit graph focus state changes.
- [ ] 2.3 Ensure hover preview does not become persistent assistant context.
- [ ] 2.4 Add no-selection and incomplete-context degraded states.

## 3. Permission Boundary

- [ ] 3.1 Resolve learner identity, resource access, evidence availability, and tool permissions through server-owned context.
- [ ] 3.2 Ensure client-provided graph hints cannot expand user, class, resource, path, evidence, or privacy scope.
- [ ] 3.3 Add tests for scoped context resolution and permission fallback.

## 4. Acceptance

- [ ] 4.1 Capture browser evidence for Konling collapsed, expanded, no-selection, selected-node, light, dark, desktop, and mobile states.
- [ ] 4.2 Verify selected-node context appears in assistant runtime metadata or a testable context contract.
- [ ] 4.3 Run `rtk openspec validate connect-knowledge-workspace-konling-context --strict`.
