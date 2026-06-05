## Context

Current specs already distinguish global product navigation, role cockpit, contextual workspace, and local tools. The problem is runtime fragmentation. This change makes navigation a real rendering framework and routes all page families toward it before page-level visual migration.

## Goals / Non-Goals

**Goals:**

- Make route inventory executable and testable.
- Preserve role cockpit and callback semantics.
- Provide mobile navigation parity for every primary route.
- Merge right-bottom controls into one dock model.

**Non-Goals:**

- Do not redesign page content here.
- Do not change authorization or route permissions.
- Do not implement every page-family migration in this change.

## Decisions

### Decision 1: Navigation frame precedes page redesign

Page visual migration depends on a stable navigation frame; otherwise each route family will keep inventing its own shell.

### Decision 2: Student intent names are canonical

Student navigation must consistently use learning intent groups: learn, practice, challenge, experiment, review/account. Profile and data center cannot compete under unclear "review" semantics.

### Decision 3: Mobile reachability is equal to desktop reachability

Hiding a desktop sidebar at mobile widths is not acceptable unless an equivalent mobile switcher or drawer exposes the same route family.

## Risks / Trade-offs

- Replacing shells can touch many pages. -> Limit this change to shell contracts, adapters, inventory, and representative routes.
- Dock unification may affect existing AI controls. -> Preserve feature visibility while changing ownership and placement.
