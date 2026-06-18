# Adaptive Path Workspace States QA

Date: 2026-06-17
Change: `separate-adaptive-path-workspace-states`

## Expected Visual Sources

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/02-path-selection-comparison.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/03-active-path-execution.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/04-history-evidence-record.png`

## Current-State Regression Sources

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/01-default-generation-desktop.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/02-contextual-recommendation-desktop.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/03-path-execution-desktop.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/04-evidence-review-desktop.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/05-contextual-recommendation-mobile.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/audit-notes.md`

## Captured Implementation Evidence

- `01-landing-desktop.png`: PASS. Landing shows generation, continuation, and evidence entry without downstream route stacks or preset goal cards.
- `02-generation-desktop.png`: PASS. Generation intent renders the editable parameter workspace as the primary surface.
- `03-selection-desktop.png`: PASS. Selection intent renders comparable path options as the primary surface.
- `04-execution-desktop.png`: PASS. Execution intent renders route map, current node detail, result/evidence summary, and resource entry without the generation panel.
- `05-evidence-review-desktop.png`: PASS. Evidence-review intent renders timeline and evidence records as the primary surface without generation controls.
- `06-generation-mobile-320.png`: PASS. Generation controls remain usable at 320px.
- `07-execution-mobile-320.png`: PASS. Route nodes and action controls are readable at 320px; the route map no longer compresses titles into one-character columns.
- `08-evidence-review-mobile-320.png`: PASS. Evidence timeline and labels remain vertically scannable at 320px.

## Fixed Mismatches

- The landing state no longer renders all downstream path selection, execution, evidence, and practice sections in one scroll.
- `path-selection` is now a first-class route intent and owns the comparison workspace.
- Successful generation routes to `intent=path-selection`; successful selection or switch routes to `intent=path-execution` with path, option, and current node context.
- Execution and evidence workspaces keep the generation panel closed by default.
- Preset goal cards are no longer rendered as the landing primary task flow.
- Mobile execution layout uses vertical route cards and hides small-screen connector chrome to avoid compressed Chinese labels.

## Student-Safe Language Scan

PASS. The reviewed student-facing workspace screenshots and page text do not expose the engineering terms blocked by the OpenSpec contract.
