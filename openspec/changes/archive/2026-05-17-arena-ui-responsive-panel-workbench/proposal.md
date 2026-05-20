## Why

The current Arena student experience still mixes legacy shell layout, single-surface workbench assumptions, and incomplete theme adaptation. This causes wasted space in the hall, inconsistent dark/light rendering on Arena pages, insufficient challenge workspace flexibility, and an official evaluation path that currently fails from the student account.

## What Changes

- Refresh Arena hall and challenge detail navigation so breadcrumbs read `首页 > 竞技场首页 > 具体挑战名称` where applicable, while the right side keeps the same personal-center entry pattern as the homepage.
- Replace the Arena left navigation with the four homepage project entries: `虚拟仿真`, `竞技场`, `知识图谱`, and `互动学习`; make the navigation adapt correctly in light and dark themes.
- Rework Arena hall density: align the title area and search/filter area into an equal-height, equal-width layout, and render challenges as two-column cards on sufficiently wide screens.
- Reconfigure Arena content page theming so dark mode does not keep white page or card backgrounds.
- Rework the challenge workbench entry layout: put session status at the top, remove the current workbench shell framing, and let the workbench content use the full page width.
- Introduce responsive workbench panel instances: challenge modes provide default panels, students can add and remove allowed panels, multiple panels of the same view type can coexist, and each panel owns its own configuration state.
- Move former shell-level view options into each panel title configuration area; preserve time-domain, Bode, and root-locus option behavior, while changing Nyquist to a single-selection option model like root locus.
- Reproduce and fix the `Arena evaluation failed` student official-submission failure through browser debugging with a student account.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `arena-student-entry-experience`: tighten Arena hall/detail navigation, four-entry left navigation, responsive hall density, and dark/light theme requirements.
- `arena-control-workbench-routing`: clarify challenge-to-workbench layout expectations after routing and ensure challenge context remains visible when the shell framing is removed.
- `control-workbench-view-configuration`: change view configuration from one global view state per view type to independent panel-instance state, including multiple same-type panels and Nyquist single selection.
- `arena-official-evaluation-consistency`: require student-account browser reproduction and repair of official evaluation failures from the workbench submit surface.

## Impact

- Affected UI surfaces: Arena page shell, Arena hall, challenge detail page, unified control workbench shell, and multi-representation workbench content.
- Affected interaction state: workbench view configuration storage changes from view-id scoped state to panel-instance scoped state.
- Affected official evaluation flow: Arena submit panel, `/api/arena/evaluate`, submission persistence, and student-account browser validation.
- No database schema change is expected unless official evaluation debugging exposes a missing persistence field or relation.
