## Context

The current UI unification has moved Arena and Control Workbench toward AppShell, but Interactive Learning, the course catalog, and first-hop Interactive Learning destinations still use `UnifiedTopBar` plus local route styling. Adaptive practice uses AppShell, but not the same route-family navigation: it shows only `学生驾驶舱` and `个人中心`, while the student journey also needs learn, practice, challenge, experiment, knowledge/resource, and evidence review paths.

## Goals / Non-Goals

**Goals:**

- Make the main student secondary routes and direct first-hop Interactive Learning destinations use AppShell and central route inventory rather than local header shells.
- Keep first-viewport task visibility for learning, course launch, and practice states.
- Preserve route intent and state handling for unauthenticated, loading, fallback, low-evidence, and demo query states.

**Non-Goals:**

- Rebuilding all course runtime pages.
- Redesigning every lesson card or module content block.
- Changing adaptive scoring, path planning, or question generation behavior.

## Decisions

### Decision 1: Learning entry and course catalog use learning-atlas AppShell

These routes are not dense mission workspaces. They should render as learning-atlas pages with central navigation, compact route trace, and content organized by current work and module progression.

### Decision 1a: First-hop Interactive Learning destinations are in scope

The entry page currently sends students directly to chapter components and cross-domain exploration. Those destinations must migrate with the entry route or be registered as narrow temporary exceptions with an owning change and removal condition. Otherwise the first real student action after opening Interactive Learning would fall back to the old navigation language.

### Decision 2: Adaptive practice keeps its learner state content but adopts route-family navigation

Adaptive practice should remain a practice-focused learner surface. The shell must not reduce navigation to `学生驾驶舱` and `个人中心`, because that disconnects it from the rest of the student journey.

### Decision 3: Content migration is structural, not a visual repaint

The migration should remove local shell and route palette ownership, then map existing content into AppShell header, content, evidence, and adjacent-action sections. Token usage alone is not sufficient.

## Risks / Trade-offs

- Learning entry routes are public, while adaptive practice is mixed/auth-aware -> route metadata must preserve public and unauthenticated states.
- Course catalog has many cards -> repeated cards are acceptable only for actual repeated courses, not as a replacement for navigation.
- Adaptive practice may have no data -> empty and fallback states must stay complete and actionable.
