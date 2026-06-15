## Context

The accepted handoff defines Direction 1 as the generation main UI, Direction 3 as path selection/display, and Direction 2 as icon semantics. Current UI is too engineering-facing and remains tied to `control-correction`. The visual result must match `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md` and the concept images, not just reuse tokens.

## Goals / Non-Goals

**Goals:**

- Build a responsive generation and path-comparison UI for all registered goals.
- Use student-safe language and remove forbidden debug strings.
- Use unified AppShell, breadcrumbs, persistent collapsed navigation, and shared Konling dock.
- Require subagent browser validation against handoff and concept images.

**Non-Goals:**

- No planner algorithm implementation.
- No history/evidence timeline implementation.
- No standalone page-local assistant rail.

## Decisions

- Make `生成学习路径` open the Konling-backed parameter panel instead of a fixed `生成控制校正学习路径` action.
- Render 2-3 comparable path options in a list, table, or information-grid comparison. Isolated marketing-style cards are explicitly rejected because they hide cross-path comparison.
- Use stable resource icons from the ResourceNode contract so path maps and option previews stay consistent.
- Treat design handoff and concept image paths as required visual QA inputs. The reviewer must check visible match, not only DOM markers.

## Risks / Trade-offs

- A dense comparison UI may overwhelm mobile. Mitigation: mobile uses stacked sections, segment tabs, or a bottom sheet while preserving full comparison access.
- Generated mockups may include decorative details that conflict with AppShell. Mitigation: follow the handoff's adopted/rejected guidance, not exact generated chrome.
- Existing adaptive practice may still need quiz access. Mitigation: keep adaptive quiz as a path node and preserve practice intent in route parameters.
