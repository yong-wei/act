## Context

The current workbench has rich chart components, but the panels assume a fixed white-box serial-correction context. Future composite, black-box, and predictive presets need different signals and availability rules. A registry avoids placing all conditions in the shell.

## Goals / Non-Goals

**Goals:**
- Define `WorkbenchViewPlugin` and `WorkbenchViewConfig` boundaries.
- Support local configuration for the four classic views.
- Prevent unsupported data from rendering as if it were official or available.

**Non-Goals:**
- No free-form drag-and-drop dashboard.
- No black-box nominal-model frequency fitting yet.
- No replacement of ECharts chart internals.

## Decisions

- Use preset-defined default configs.
  Rationale: challenge mode should be coherent on first load; students can adjust local display options later.

- Store view configuration in component/local session state first.
  Rationale: persistence to database is premature until saved workbench sessions exist.

- Treat root locus as single-source selection, not overlay.
  Rationale: overlaying root loci is easy to misread. The design should force one of corrected, uncorrected, or nominal model.

## Risks / Trade-offs

- [Risk] View configuration can become visually busy.
  → Mitigation: keep controls inside compact view menus, not the main context bar.

- [Risk] The view registry may overabstract early.
  → Mitigation: implement only four concrete view plugins first and keep plugin contracts small.
