## Context

The platform currently mixes two spacing models. AppShell route frames center primary content inside fixed maximum widths such as `max-w-7xl`, `max-w-[1500px]`, and `max-w-[1600px]`, while many feature surfaces add their own `mx-auto max-w-*` wrappers. Interactive course runtime pages add a second local cap through `premium-lesson-main mx-auto max-w-[1180px]` and course headers commonly use `max-w-[1280px]`.

This produces inconsistent wide-screen behavior: graph canvases, course modules, text pages, forms, dashboards, and operations pages often occupy the middle of the viewport while large side gutters grow with screen width. The desired product direction is a sitewide compact edge system: pages use narrow, fixed viewport edges and the available width for actual content.

## Goals / Non-Goals

**Goals:**

- Establish a single compact edge-spacing contract for AppShell route frames and feature-level page shells.
- Make wide screens usable by default across workspaces, interactive content, text, forms, dashboards, reports, and data maps.
- Replace page-level max-width centering with shared spacing tokens/classes that keep left/right edges stable at 1440px, 1920px, and 2560px.
- Bring interactive course runtime header/main wrappers into the same compact edge system.
- Build a complete page-level wrapper inventory so every existing centered page cap is migrated or explicitly classified as a component-intrinsic or temporary exception.
- Add governance so future and existing unclassified `mx-auto max-w-*` or `container mx-auto` page wrappers are rejected.

**Non-Goals:**

- Redesigning each page's information architecture, component hierarchy, or business workflow.
- Changing database, API, authorization, resource registry, or runtime lesson manifest semantics.
- Removing intrinsic constraints for dialogs, popovers, image preview modals, small controls, charts that require a fixed aspect ratio, or print/PDF exports.
- Implementing the visual changes in this proposal.

## Decisions

### Use shared compact spacing tokens instead of raising max-width values

The implementation should introduce shared AppShell/content spacing tokens or class helpers that express page-level edge spacing, for example a compact content frame with fixed horizontal padding and no dynamic max-width. Simply increasing `max-w-[1500px]` to a larger value would postpone the issue until wider displays and would keep the same inconsistent mental model.

### Treat page-level centering as opt-in debt, not the default

Route frames, workspaces, and course runtime shells should default to full available width with narrow edges. Any remaining page-level max-width must be explicitly justified as component-intrinsic rather than inherited from historical page layout habits. The governance check should distinguish page shells from internal components so modals and small embedded widgets are not incorrectly rejected.

### Update shared shells before page-by-page cleanup

The first implementation pass should update AppShell route frame classes and interactive course shared shell patterns. This removes the largest repeated source of wide gutters before targeted cleanup of route-local wrappers. Page-by-page edits should then focus on wrappers still visible in wide-screen captures or source-level governance output.

### Validate through visual metrics, not screenshots alone

Screenshots are necessary but insufficient. The visual audit should record DOM metrics for the main content frame, primary workspace/instrument area, and representative page edges at 1024px, 1100px, 1279px, 1440px, 1920px, 2560px, tablet, and 320px. Screenshots and DOM metrics are both required. The accepted behavior is stable edge spacing; the left/right content edge may shift only because of navigation rail width, not because of viewport-centered max-width containers.

### Require full inventory closure before acceptance

Representative route evidence proves visual behavior, but it cannot substitute for all-route source coverage. The implementation should produce or update an inventory of every page-level centered width wrapper in route files, shared shells, interactive runtime pages, and legacy workspace shells. Acceptance requires each item to be migrated or classified with owner, scope, reason, and removal or permanence condition. Unclassified entries remain blocking debt.

## Risks / Trade-offs

- **Risk: long text becomes overly wide** -> Mitigation: keep typography controls inside article/body text components when genuinely needed, but the page frame itself still uses compact edges; text blocks can use columns, panels, or internal reading measures without wasting the whole viewport.
- **Risk: broad source rewrite touches many files** -> Mitigation: start from shared shells and representative routes, then let governance identify remaining page-level wrappers for staged cleanup.
- **Risk: visual regressions in mobile or tablet layouts** -> Mitigation: require 320px and tablet evidence alongside wide-screen captures.
- **Risk: AppShell frame changes affect many routes at once** -> Mitigation: use route-frame tests and screenshot/DOM metric evidence before accepting the implementation.
- **Risk: local `max-w-*` classes used for legitimate component sizing are over-reported** -> Mitigation: require the governance rule to scope failures to page-level wrappers and accept registered component-intrinsic exceptions.
- **Risk: representative evidence hides unclassified pages** -> Mitigation: require full wrapper inventory closure in addition to representative visual evidence.
