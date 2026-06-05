## Context

Recent UI work created a common dark shell, token vocabulary, visual QA matrix, and route evidence artifacts. Browser review still shows the platform as a dark card system with competing navigation patterns: homepage top nav, Arena sidebar, UnifiedTopBar, Control Workbench local header, knowledge graph split panels, teacher/admin consoles, and floating controls. The redesign must stop adapting every page in place and instead make every page conform to one product framework.

The design read is: a commercial maritime control-learning platform for students, teachers, and administrators, with a premium technical-navigation language. The intended feel is not generic AI education. It should feel like a mission atlas, instrument desk, evidence ledger, and teaching operations system.

## Goals / Non-Goals

**Goals:**

- Establish one design thesis and route archetype system for all major page families.
- Treat light and dark themes as two designed templates, not one theme derived from the other.
- Make navigation hierarchy explicit and non-competing before page migrations begin.
- Create hard acceptance rules so downstream pages cannot pass by only adopting colors, borders, or `data-commercial-*` markers.

**Non-Goals:**

- Do not redesign individual pages in this foundation change.
- Do not choose final bitmap/logo artwork here; downstream brand-token work produces implementation assets.
- Do not remove legacy shells here; downstream navigation and page-family changes do that.

## Decisions

### Decision 1: The design thesis is "Instrument Atlas"

The platform should read as a measured route system for control learning. Pages should use route traces, instrument panels, evidence ledgers, chart grids, and mission states as the main visual logic. This is stronger than the current generic dark-tech card system and maps naturally to maritime control, Arena tasks, adaptive paths, knowledge graphs, reports, and governance.

### Decision 2: Route archetypes replace page-local composition

Every primary route must declare one archetype:

- `public-entry`: homepage, login, public learning entry.
- `learning-atlas`: interactive learning, course catalog, adaptive entry, student path overview.
- `mission-workspace`: Control Workbench, Arena task detail, simulations, interactive runtime.
- `knowledge-data-map`: knowledge graph, data center, evidence browser, learner record.
- `operations-console`: teacher and admin workflows.
- `report-ledger`: teacher reports, governance snapshots, exported review surfaces.

Each archetype owns navigation layers, density, first-viewport expectations, local tool placement, and mobile behavior.

### Decision 3: Light and dark are separate templates

Light mode uses daylight engineering chart paper, matte panels, printed trace grids, and evidence stamps. Dark mode uses night bridge canvas, low-light instruments, trace glow, and controlled alert colors. Both must share geometry, hierarchy, and route semantics, but each needs its own palette and contrast tuning.

### Decision 4: Navigation has four layers

Navigation must be separated into product orientation, role cockpit, contextual route trace, and local tools. A page should not show all layers at equal weight. This directly addresses current duplication between global links, cockpit/profile links, sidebars, breadcrumbs, and floating controls.

## Risks / Trade-offs

- Large scope may be diluted into cosmetic token changes. -> Mitigation: downstream acceptance requires archetype mapping and representative browser evidence.
- Existing page-specific shells may resist migration. -> Mitigation: foundation explicitly allows replacing incompatible shells instead of adapting them.
- Strict governance may block incremental work. -> Mitigation: allow temporary migration exceptions only when scoped, dated, and tied to a downstream issue.
