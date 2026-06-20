## 1. Service Boundary

- [ ] 1.1 Add graph-center payload service for domain, objective, portrait-dimension, and selected-node inputs.
- [ ] 1.2 Include limitations for missing seed coverage and unavailable overlays.
- [ ] 1.3 Keep graph body data separate from overlay placeholders.

## 2. UI Foundation

- [ ] 2.1 Add `/graph-center` read-only page using AppShell.
- [ ] 2.2 Support knowledge, capability, and quality domain switching.
- [ ] 2.3 Support objective and portrait-dimension filters.
- [ ] 2.4 Support node detail inspection.
- [ ] 2.5 Preserve `/knowledge` compatibility as the knowledge-domain entry.
- [ ] 2.6 Provide mobile list/detail fallback.

## 3. Verification

- [ ] 3.1 Add service tests for filtering and detail payloads.
- [ ] 3.2 Add page or component test for opening graph center, switching domain, filtering, and viewing details.
- [ ] 3.3 Run `rtk openspec validate build-graph-center-readonly-foundation --strict`.
