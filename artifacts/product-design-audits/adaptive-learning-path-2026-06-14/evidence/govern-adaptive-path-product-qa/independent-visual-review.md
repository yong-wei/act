# Independent Visual Review

Review status: passed — the final 13-state capture completed independent GPT visual review.

Change: `govern-adaptive-path-product-qa`

Reviewer: GPT ui-flow-reviewer

Review scope: accepted-P1-expanded-dock-remediation

Final verdict: PASS — no P0/P1 blocking findings.

## Current refresh

The 13-state PNG matrix was regenerated against clean source HEAD `39a41ddb9431fba73699c58813363dc01cf97cb2` (tree `45b320e5377ccd002afc562b69fce0edefd8d432`, fixed-source fingerprint `c3fbe6363b2c6a73bea8ffcb8eff122ed8bab5a895a15209dc1eb068a3a33a57`). Independent review verified all 13 PNG hashes against the capture manifest and visual signals. All states report no horizontal overflow and no forbidden diagnostics.

The repaired `app-shell-expanded-dock-desktop-dark` state now proves its actual contract: the shared AppShell navigation is expanded, the floating-control secondary trigger and its 224×62 panel are visible, GlobalAI is the enabled primary control, and the adaptive-path `控灵助手` appears in that panel while remaining disabled. The Global AI sidebar is not opened. The expanded panel does not obstruct the path workspace or its critical actions.

Blocking findings: none.

No unresolved BLOCK findings remain.

Residual risk: this expanded-dock semantic is intentionally desktop-only; existing mobile capture states continue to cover responsive behavior and do not claim that a dock panel should be expanded.

## 2026-08-01 PR #1152 Refresh

The 13-state adaptive-path matrix was recaptured after the cold-start explanation change. The reviewer confirmed that the recommendation basis and improvement guidance remain readable at desktop and 320px widths, the mobile navigation entry is visible, all mobile signals remain free of horizontal overflow, and the existing comparison, execution, skip-confirmation, and learning-record states remain usable. No P0/P1 regression introduced by PR #1152 was found.

The initial concern that the `contextual-recommendation` demo showed an unavailable path-advisor dependency was rejected as a PR blocker: that external demo dependency state predates this change, PR #1152 does not modify path generation, and its declared scope is the student-facing cold-start explanation. The dedicated checkout-bound `cold-start-1151` capture separately verifies that the landing-intent generation action is visible and enabled at 1440px and 320px. Expanding the mobile navigation drawer and exercising a real backend generation-to-execution journey remain non-blocking acceptance gaps outside this display-only change.

## 2026-07-11 Source Refresh

The official 13-state capture matrix was rerun against the current worktree on a fresh local server. The matrix now records the normalized one-route comparison, inline node detail, skip confirmation, and the explicitly disabled demo-mode dock state instead of claiming an unavailable Konling parameter panel. Desktop light and mobile dark active-path states were inspected directly: route progress, current-node emphasis, checkpoint evidence, actions, responsive stacking, and the right-bottom shared dock remain legible and collision-free. No new BLOCK finding was observed.

## Source Inputs

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/02-path-selection-comparison.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/03-active-path-execution.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/04-history-evidence-record.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/evidence/govern-adaptive-path-product-qa/handoff-to-implementation-matrix.md`
- `artifacts/commercial-ui/adaptive-path-product-qa-516/capture-manifest.json`
- `artifacts/commercial-ui/adaptive-path-product-qa-516/visual-signals.json`
- `artifacts/commercial-ui/adaptive-path-product-qa-516/*.png`

## Initial BLOCK Findings And Resolution

| Finding | Severity | Resolution |
| --- | --- | --- |
| Prior evidence reused stale `adaptive-path-execution-history-514` screenshots and mismatched target/theme metadata. | BLOCK | Fresh evidence was recaptured into `artifacts/commercial-ui/adaptive-path-product-qa-516/`, and the matrix now binds each state to current screenshots. |
| The prior execution route map looked like disconnected cards and did not prove a complete path. | BLOCK | The execution UI now renders connected route flow with `data-adaptive-path-route-flow="connected"`. |
| Cold-start/generation states exposed the active practice question. | P1 | The practice question defaults to `data-adaptive-practice-question="summary"` and expands only on explicit user action. |
| Theme evidence used the wrong storage key. | P1 | The capture script writes `ai-obe-theme` and records `htmlClass`, `colorScheme`, and `storedTheme`. |

## PASS/BLOCK Review Matrix

| Area | Result | Evidence |
| --- | --- | --- |
| Handoff alignment | PASS | The matrix binds all four concepts to 13 fresh screenshots and current source behavior. |
| Concept adoption and rejection | PASS | Generation, comparison, execution, and history concepts are adopted or merged according to the handoff; mock-only chrome and debug language are rejected. |
| AppShell continuity | PASS | The page is wrapped by shared `AppShell` with breadcrumbs, account/theme controls, collapsible navigation, and shared dock. |
| Fluid workspace layout | PASS | Desktop uses responsive workspace regions; captured signals show no horizontal overflow. |
| Non-card path comparison | PASS | Comparison remains a comparable information grid/list, not isolated marketing cards. |
| Konling dock | PASS | Konling remains the shared right-bottom dock in collapsed and expanded states. |
| Icon semantics | PASS | Resource type glyphs and checkpoint semantics remain stable across path options and execution nodes. |
| Path map clarity | PASS | Execution evidence shows a connected route flow with three path nodes and current-node emphasis. |
| History/evidence hierarchy | PASS | Evidence uses student-safe source labels and states such as `可用于推荐`, `待复核`, and `仅作参考`. |
| Cold-start usability | PASS | Starter path language is product-facing and the practice question is not exposed by default. |
| Theme parity | PASS | Light and dark captures report matching `htmlClass`, `colorScheme`, and `storedTheme`. |
| Mobile behavior | PASS | 320px captures reflow into task-first vertical panels with no horizontal overflow. |
| Text fit | PASS | Key labels, actions, route nodes, and history entries remain readable in desktop and mobile captures. |
| Forbidden strings | PASS | `visual-signals.json` reports an empty `forbidden` array for all 13 captures. |

## Residual Risk

No unresolved BLOCK findings remain. Main-thread verification must still run commercial UI governance, targeted unit tests, TypeScript, lint, and OpenSpec strict validation.
