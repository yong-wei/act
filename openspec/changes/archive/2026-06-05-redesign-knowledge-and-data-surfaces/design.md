## Context

Mobile browser review found `/knowledge` visually dominated by fixed sidebar and filter panels, leaving little usable graph canvas. Data center and governance snapshots need a related information-map language without moving business data ownership into shared UI.

## Goals / Non-Goals

**Goals:**

- Make knowledge graph canvas visible and usable at desktop and mobile sizes.
- Move mobile directory/filter controls into drawers or sheets.
- Unify knowledge/data surfaces around source quality, freshness, privacy, and evidence legends.

**Non-Goals:**

- Do not change knowledge graph data model.
- Do not move ResourceNode, data governance, or launch business logic into shared UI.

## Decisions

### Decision 1: Knowledge mobile is canvas-first

Small screens should show the graph/canvas first, not permanent sidebars. Directory and filter controls become invoked panels.

### Decision 2: Data center snapshots use evidence map language

Data surfaces should show source quality, freshness, privacy scope, and status legend consistently with knowledge graph and governance surfaces.

## Risks / Trade-offs

- Graph filters are complex. -> Preserve all controls but relocate them with explicit open/close affordances and keyboard focus.
- Data center can overlap report/gov ownership. -> Route ledger assigns owning changes and report export is handled separately.
