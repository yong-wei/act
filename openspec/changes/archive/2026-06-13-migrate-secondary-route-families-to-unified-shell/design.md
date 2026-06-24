## Context

The platform already has `AppShell`, central role navigation, route inventory, and representative migrations for Arena, Interactive Learning entry routes, adaptive practice, knowledge graph, and data center. The remaining problem is route-family continuity: users can enter a unified page and then click one level deeper into a page-local shell, fixed-width dark page, or ungoverned tool overlay.

Current evidence from the resource worktree:

- `/interactive-learning`, `/interactive-learning/courses`, `/interactive-learning/chapter-components`, and `/interactive-learning/cross-domain-exploration` use `InteractiveLearningShell`.
- `/interactive-learning/chapter-components/[category]` and `/interactive-learning/resources/[id]` do not expose `data-platform-route-frame`, `data-app-shell-layout`, or AppShell collapse controls.
- `/knowledge` uses `AppShell` and marks graph controls as local panels, but desktop relation filters are a permanent overlay and mobile tools are separate `details` controls.
- AppShell collapse expands the outer workspace, but some migrated pages keep inner `max-w` containers that preserve the same visual empty margins.

## Goals / Non-Goals

**Goals:**

- Make first-hop and descendant route families inherit a unified shell, route trace, and role-aware navigation.
- Define content-width behavior by route archetype so collapsed navigation creates usable workspace area.
- Convert knowledge graph filters, chapter directory, legend, view switch, and resource panel into collapsible or drawer-based local tools.
- Extend visual and DOM evidence beyond representative parent routes to first-hop destinations.
- Keep governance checks aligned with `enforce-secondary-navigation-visual-governance`.

**Non-Goals:**

- Redesign the entire visual brand system.
- Rewrite lesson runtime content, simulation engines, ResourceNode business logic, or Arena evaluation behavior.
- Force every private runtime page into the same layout in one commit; runtime-heavy pages may use narrow exceptions with expiry and removal conditions.
- Replace valid immersive workspace shells when they already provide AppShell-compatible navigation, breadcrumbs, and evidence.

## Decisions

### 1. Treat route families as the migration unit

Route inventory should record parent routes and covered descendants. A route such as `/interactive-learning/chapter-components` is not accepted if its primary next action opens `/interactive-learning/chapter-components/[category]` outside the unified shell.

Alternative considered: migrate only representative pages and rely on governance sampling. That preserves the current failure mode, where screenshots pass but real navigation breaks one click later.

### 2. Use shell adapters before deep feature rewrites

Interactive resource pages, chapter category pages, and lightweight review pages should enter `AppShell` through small adapters. Heavy runtime pages can use approved workspace shells or temporary exceptions while their runtime controls are mapped into shell slots.

Alternative considered: rewrite each feature page independently. That would increase visual drift and duplicate breadcrumb, navigation, dock, and responsive behavior.

### 3. Separate platform navigation from local tools

Knowledge graph filters, legends, resource details, and view switches remain feature-owned local tools, but their placement and collapse behavior must follow a platform contract. AppShell owns global navigation and route trace; the knowledge feature owns graph semantics and tool state.

Alternative considered: move graph controls into global navigation. That would blur local task controls with product navigation and make the shell domain-specific.

### 4. Make width rules archetype-specific

Learning-atlas entry pages can keep readable content constraints for text-heavy sections, but graph/data/workspace pages must use fluid workspace tracks after navigation collapse. Width constraints should be attached to inner reading blocks, not the entire page.

Alternative considered: remove all max-width constraints. That would harm readability on course catalog and lesson entry pages.

## Risks / Trade-offs

- Route-family inventory may be incomplete because `src/app` contains many private and legacy pages. Mitigation: begin with first-hop student journeys and pages currently reachable from unified entry surfaces, then expand inventory by archetype.
- Some lesson runtime pages use premium lesson shells with local control density. Mitigation: register bounded exceptions and migrate shared runtime wrappers before editing individual units.
- Knowledge graph tool collapse can hide important filters. Mitigation: preserve active filter summaries and make the open/closed state visible in both desktop and mobile evidence.
- Visual evidence can be expensive. Mitigation: capture representative parent plus first-hop descendant pairs and supplement with DOM checks for route frame, collapse state, local tool state, and width behavior.

## Migration Plan

1. Add route-family inventory metadata for Interactive Learning first-hop pages, resource detail pages, knowledge graph tools, simulation descendants, and high-priority teacher/admin descendants.
2. Migrate `/interactive-learning/chapter-components/[category]` and `/interactive-learning/resources/[id]` to a shared Interactive Learning shell adapter with contextual breadcrumbs and return targets.
3. Adjust learning-atlas content containers so page-wide max width does not block workspace expansion where the archetype expects broader use.
4. Convert knowledge graph desktop relation filters and chapter directory into collapsible local tools, and consolidate mobile graph tools into a drawer or focused tool panel.
5. Register or migrate the first extended-route batch: `/simulations/lng` as the simulation descendant representative, `/teacher/classes/new` and `/teacher/classes/[classId]` as teacher class create/detail representatives, `/teacher/lesson-plans/new` and `/teacher/lesson-plans/[id]/edit` as teacher lesson-plan create/edit representatives reachable from both `/teacher` and `/teacher/lesson-plans`, and both `/admin/lesson-plans/new` and `/admin/lesson-plans/[id]/edit` as administrator create/edit representatives reachable from `/admin/lesson-plans`.
6. Replace newly touched page-local color families with platform tokens on migrated route-family surfaces.
7. Add evidence and tests for parent-to-first-hop continuity, collapsed width behavior, mobile navigation access, local-tool open/closed states, route inventory coverage, and explicit exceptions.

## Source Continuity Matrix

The implementation must treat a descendant route and its source route as one acceptance unit. The first migration batch must cover these source paths:

| Source | Descendant | Required continuity |
| --- | --- | --- |
| `/interactive-learning/chapter-components` | `/interactive-learning/chapter-components/[category]` | Breadcrumb and return target keep chapter component context. |
| `/interactive-learning/chapter-components/[category]` | `/interactive-learning/resources/[id]` | Breadcrumb and return target keep selected category context. |
| `/interactive-learning/cross-domain-exploration` | `/interactive-learning/resources/[id]` | Breadcrumb and return target keep cross-domain exploration context. |
| `/teacher` | `/teacher/lesson-plans/new` and `/teacher/lesson-plans/[id]/edit` | Breadcrumb and return target keep teacher dashboard context when launched there. |
| `/teacher/lesson-plans` | `/teacher/lesson-plans/new` and `/teacher/lesson-plans/[id]/edit` | Breadcrumb and return target keep lesson-plan list context. |
| `/teacher/preset-lessons` | `/teacher/lesson-plans/[id]/edit` | Clone-to-edit flow returns to the preset lesson context or records a source-scoped exception. |
| `/teacher/classes/[classId]` | `/teacher/lesson-plans/new` | Missing-plan creation flow returns to the class context or records a source-scoped exception. |
| `/admin/lesson-plans` | `/admin/lesson-plans/new` and `/admin/lesson-plans/[id]/edit` | Breadcrumb and return target keep administrator lesson-plan list context. |

## Open Questions

- Which private lesson runtime family should be the first runtime-shell migration after the lightweight first-hop pages: current Unit 1-1, all premium entry pages, or the generic course runtime wrapper?
- Should AI and review routes remain primary platform routes, or should they be demoted to internal tools with narrower exceptions?
