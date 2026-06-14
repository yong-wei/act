## Why

Several knowledge graph UI requirements already exist, but the product quality risk now sits in integration: shell state, local tools, inspector behavior, graph interaction stability, Konling dock, light/dark themes, and mobile layout must work together. A final governance change is needed so the redesign cannot pass with isolated partial fixes.

## What Changes

- Add a knowledge workspace product QA matrix covering shell navigation, graph semantic-map presentation, graph tools, node inspector, graph interaction stability, Konling dock, theme parity, and mobile behavior.
- Treat `artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md` as the product design source of truth, with concept images used only through the handoff's adopted, rejected, and merged guidance.
- Require evidence that cites the design handoff and approved Product Design concepts, then documents adopted, rejected, and intentionally merged elements.
- Require an independent visual review subagent to compare implementation screenshots against the handoff and concept images and return PASS/BLOCK before the QA change can complete.
- Require browser evidence for hover, click, drag, inspector, local tools, Konling, default collapsed AppShell, light/dark, 320px mobile, and the most crowded combined workspace state.
- Require governance to treat current source/runtime behavior as truth rather than relying only on historical screenshots.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-ui-governance-gates`: define final product QA gates for the redesigned knowledge graph workspace.

## Impact

- Affects visual evidence scripts, governance tests, acceptance manifests, and review checklists.
- Depends on the preceding shell, interaction, tool/inspector, and Konling changes.
- Does not implement UI migration itself.
