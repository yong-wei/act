## Context

The current Control Workbench already exposes commercial zones, but the first viewport can be dominated by process, boundary, and panel-management text. Arena and simulations still use separate shells. The target is a mission workspace: main instrument first, configuration second.

## Goals / Non-Goals

**Goals:**

- Make task context, object, current step, and primary visualization visible early.
- Standardize workspace zones and local tools across simulation, Arena, workbench, and course runtime.
- Provide mobile sheet/drawer structures for filters, panel setup, and support content.

**Non-Goals:**

- Do not modify WASM, numerical simulation, Arena scoring, or course submission semantics.

## Decisions

### Decision 1: Instrument area is the hero of workspaces

Dense workspaces should not open as documentation or configuration forms. The main visualization/instrument area must dominate the user flow.

### Decision 2: Mobile workspace is sheet-based

At small widths, object selection, method boundaries, panel setup, and evidence/support content move into sheets or drawers. They must not all remain inline above the graph/canvas.

## Risks / Trade-offs

- Moving controls into drawers can hide advanced options. -> Keep current step and primary command visible, and expose secondary controls through clear command slots.
- Workspace pages span several domains. -> Keep business state in feature layers and only share shell primitives.
