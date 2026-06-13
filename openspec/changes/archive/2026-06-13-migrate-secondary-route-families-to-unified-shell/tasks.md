## 1. Route Family Inventory

- [x] 1.1 Register first-hop Interactive Learning descendants, including chapter category routes and resource detail routes, with shell frame, role scope, mobile behavior, dock behavior, and owner metadata.
- [x] 1.2 Register route-family coverage or bounded exceptions for premium lesson entry/runtime routes, simulation descendants, AI/review routes, and high-priority teacher/admin descendant pages.
- [x] 1.3 Add tests proving migrated parent routes cannot point first actions to unregistered descendant shells.

## 2. Interactive Learning Descendant Shells

- [x] 2.1 Introduce or extend an Interactive Learning shell adapter for `/interactive-learning/chapter-components/[category]` with route-derived breadcrumbs and platform navigation.
- [x] 2.2 Migrate `/interactive-learning/resources/[id]` into the approved shell or an approved resource workspace shell while preserving `ResourceRenderer` behavior, route-derived breadcrumbs, and source-aware return targets for both category-origin and cross-domain-origin launches.
- [x] 2.3 Replace page-local dark palettes and fixed headers on migrated Interactive Learning descendant routes with platform tokens and shell slots.
- [x] 2.4 Add desktop and mobile evidence for the full `/interactive-learning/chapter-components -> [category] -> resources/[id]` chain and `/interactive-learning/cross-domain-exploration -> resources/[id]` chain, including breadcrumb labels, active route state, source-aware return target, and back-path correctness.

## 3. Content Width Behavior

- [x] 3.1 Define reusable content width primitives or route-frame conventions for reading-width, atlas-width, and fluid workspace-width regions.
- [x] 3.2 Update migrated learning-atlas, knowledge-data-map, and mission-workspace pages so collapsed navigation expands the primary workspace where the archetype requires it.
- [x] 3.3 Add DOM or Playwright checks for expanded versus collapsed primary workspace width on parent-plus-first-hop chains, including `/interactive-learning/chapter-components -> /interactive-learning/chapter-components/[category] -> /interactive-learning/resources/[id]`.
- [x] 3.4 Register explicit reading-width exceptions for any migrated first-hop descendant whose route-wide width should remain constrained.
- [x] 3.5 Require workspace-width routes to show an observable primary workspace width increase after navigation collapse; reading-width exceptions SHALL NOT satisfy workspace-width acceptance.

## 4. Knowledge Graph Local Tools

- [x] 4.1 Convert desktop chapter directory and relation filters into collapsible local tools with visible open and closed states.
- [x] 4.2 Consolidate mobile knowledge graph tools into a drawer, sheet, or focused tool panel that keeps the graph canvas and floating dock reachable.
- [x] 4.3 Preserve active filter summaries when knowledge graph tools are collapsed.
- [x] 4.4 Replace newly touched knowledge graph panel color classes with platform semantic token roles.
- [x] 4.5 Add tests or evidence for relation filters, chapter directory, legend, view switch, and resource panel open/closed/mobile states, including active filter summaries while tools are collapsed.

## 5. Extended Route Families

- [x] 5.1 Register `/simulations/lng` as the first simulation descendant representative and either migrate it to an approved shell or record an exception with desktop/mobile evidence and removal condition.
- [x] 5.2 Register `/teacher/classes/new` and `/teacher/classes/[classId]` as teacher class operations descendants and either migrate each to an approved shell or record separate exceptions with desktop/mobile evidence and removal conditions.
- [x] 5.3 Register `/teacher/lesson-plans/new` and `/teacher/lesson-plans/[id]/edit` as teacher lesson-plan create/edit descendants reachable from `/teacher`, `/teacher/lesson-plans`, `/teacher/preset-lessons`, `/teacher/classes/[classId]`, new-to-edit flow, clone-to-edit flow, and direct edit entries, then either migrate each source to an approved shell with source-aware breadcrumbs/return targets or record separate source-scoped exceptions with desktop/mobile evidence and removal conditions.
- [x] 5.4 Register both `/admin/lesson-plans/new` and `/admin/lesson-plans/[id]/edit` as administrator lesson-plan create/edit descendants reachable from `/admin/lesson-plans`, new-to-edit flow, and direct edit entries, then either migrate each source to an approved shell with source-aware breadcrumbs/return targets or record separate source-scoped exceptions with desktop/mobile evidence and removal condition.
- [x] 5.5 Decide whether AI and review routes remain primary platform routes or become internal tools, then update route inventory accordingly.

## 6. Governance and Verification

- [x] 6.1 Produce route-family inventory fixtures, exception metadata, and migrated-route evidence consumed by `enforce-secondary-navigation-visual-governance`.
- [x] 6.2 Capture manual browser evidence at 1440px expanded/collapsed and 320px mobile for `chapter-components -> [category] -> resources/[id]`, `cross-domain-exploration -> resources/[id]`, `/knowledge` tool open/closed/mobile states, `/simulations/lng`, `teacher/classes -> teacher/classes/new -> teacher/classes/[classId]`, `teacher -> teacher/lesson-plans/new -> teacher/lesson-plans/[id]/edit`, `teacher -> teacher/lesson-plans/[id]/edit`, `teacher/lesson-plans -> teacher/lesson-plans/new -> teacher/lesson-plans/[id]/edit`, `teacher/lesson-plans -> teacher/lesson-plans/[id]/edit`, `teacher/preset-lessons -> teacher/lesson-plans/[id]/edit`, `teacher/classes/[classId] -> teacher/lesson-plans/new`, `admin/lesson-plans -> admin/lesson-plans/new -> admin/lesson-plans/[id]/edit`, and `admin/lesson-plans -> admin/lesson-plans/[id]/edit`.
- [x] 6.3 Run focused route inventory checks and the existing commercial UI governance tests without adding new gate ownership to this change.
- [x] 6.4 Run `rtk openspec validate migrate-secondary-route-families-to-unified-shell --strict`.
- [x] 6.5 Run `rtk openspec validate --changes --strict` and record any unrelated active-change debt separately.
