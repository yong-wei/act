## 1. Service Boundary

- [x] 1.1 Add graph-center payload service for domain, objective, portrait-dimension, and selected-node inputs.
- [x] 1.2 Include limitations for missing seed coverage and unavailable overlays.
- [x] 1.3 Keep graph body data separate from overlay placeholders.

## 2. UI Foundation

- [x] 2.1 Add `/graph-center` read-only page using AppShell.
- [x] 2.2 Support knowledge, capability, and quality domain switching.
- [x] 2.3 Support objective and portrait-dimension filters.
- [x] 2.4 Support node detail inspection.
- [x] 2.5 Preserve `/knowledge` compatibility as the knowledge-domain entry.
- [x] 2.6 Provide mobile list/detail fallback.

## 3. Verification

- [x] 3.1 Add service tests for filtering and detail payloads.
- [x] 3.2 Add page or component test for opening graph center, switching domain, filtering, and viewing details.
- [x] 3.3 Run `rtk openspec validate build-graph-center-readonly-foundation --strict`.
