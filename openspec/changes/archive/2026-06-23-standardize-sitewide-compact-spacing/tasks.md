## 1. Inventory And Spacing Contract

- [x] 1.1 Inventory AppShell route-frame content classes and record current page-level max-width behavior for each registered archetype.
- [x] 1.2 Produce a complete inventory of route-level and shell-level `mx-auto max-w-*`, `container mx-auto`, and interactive course `premium-lesson-main`/course-header wrappers that affect primary content width.
- [x] 1.3 Define shared compact edge spacing tokens or class helpers for desktop, tablet, and 320px mobile.
- [x] 1.4 Define the component-intrinsic and temporary exception format for dialogs, popovers, media previews, print/export pages, chart aspect wrappers, explicitly measured text components, and any route-level transition debt.
- [x] 1.5 Classify every inventory item as migrated, component-intrinsic exception, temporary exception, or blocking unclassified debt; do not accept the change while unclassified page-level wrappers remain.

## 2. AppShell And Route Frames

- [x] 2.1 Update AppShell content frame classes so registered route archetypes use compact page edges rather than dynamic wide-screen max-width centering.
- [x] 2.2 Ensure collapsed, expanded, and hidden navigation states shift content only by navigation rail width and compact spacing.
- [x] 2.3 Update route inventory or frame metadata where needed to document compact spacing and any temporary exceptions.
- [x] 2.4 Add or update platform shell tests that assert route archetypes no longer default to centered page-level max-width wrappers.

## 3. Interactive Course Runtime And Workspaces

- [x] 3.1 Replace shared interactive course header/main page-level max-width wrappers with compact edge spacing.
- [x] 3.2 Update repeated course runtime student and teacher pages that still hard-code page-level `max-w-[1180px]` or `max-w-[1280px]`.
- [x] 3.3 Verify standard module chrome, visual stages, compute panels, quizzes, forms, and teacher controls use available compact workspace width without horizontal overflow.
- [x] 3.4 Update representative mission, knowledge/data, operations, and report workspaces that still use page-level centered maximum-width wrappers.

## 4. Governance And Tests

- [x] 4.1 Extend commercial UI governance to detect unregistered page-level centered max-width wrappers across route files, AppShell frame definitions, interactive runtime shells, legacy shells, and workspace wrappers.
- [x] 4.2 Add an exception registry or equivalent allowlist for component-intrinsic width constraints with owner, reason, scope, and permanence/removal condition.
- [x] 4.3 Update commercial UI governance tests for compact edge spacing, source-level wrapper detection, and approved exceptions.
- [x] 4.4 Run targeted platform shell, commercial UI governance, and interactive course runtime tests.

## 5. Visual Verification

- [x] 5.1 Capture representative wide-screen screenshots and DOM metrics at 1440px, 1920px, and 2560px for knowledge graph, interactive course runtime, adaptive practice, simulation/control workspace, teacher operations, report/evidence pages, text-first pages, form-first pages, and interactive course entry pages.
- [x] 5.2 Capture mixed desktop screenshots and DOM metrics at 1024px, 1100px, and 1279px for routes with local tools, inspectors, floating docks, runtime control bars, or support drawers, covering expanded, collapsed, and hidden navigation states as applicable.
- [x] 5.3 Capture tablet and 320px mobile screenshots and DOM metrics for the same representative route families.
- [x] 5.4 Record DOM metrics for primary content edge, navigation rail edge, compact edge token tolerance, workspace/instrument area, and floating dock/inspector collision boundaries.
- [x] 5.5 Fix any visual audit findings for text overlap, horizontal overflow, unreachable controls, floating dock collision, or reintroduced wide gutters.

## 6. Documentation And Closeout

- [x] 6.1 Update UI governance or design-system documentation to describe the compact edge model and exception policy.
- [x] 6.2 Run `openspec validate standardize-sitewide-compact-spacing --strict`.
- [x] 6.3 Before implementation PR review, ensure all tasks are complete, affected specs validate after archive, and visual evidence is linked from the PR.
