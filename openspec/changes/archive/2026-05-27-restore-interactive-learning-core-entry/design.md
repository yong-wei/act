## Context

The current shared role-navigation model defines six student core entries: simulations, knowledge resources, Arena, Control Workbench, adaptive learning, and profile. Homepage, dashboard, and Arena shell consume this shared model, so changing the model is the correct integration point for homepage and student-shell navigation.

`/interactive-learning` already exists as a hub with three sub-entries: cross-domain exploration, interactive courses, and chapter components. Control Workbench also exists as a separate core entry, so the hard-coded cross-domain “综合仿真工作台” card duplicates a first-class destination and hides the lower-level exploration resources.

## Goals / Non-Goals

**Goals:**

- Make `Interactive Learning` a first-class student core entry targeting `/interactive-learning`.
- Keep `Control Workbench` as a first-class student core entry.
- Keep `/profile` reachable through account, cockpit, and profile-specific surfaces.
- Remove public catalog duplication of the upgraded multi-representation/classic workbench from cross-domain exploration.
- Keep Control Odyssey and other non-workbench exploration resources discoverable.

**Non-Goals:**

- Do not delete `/profile`.
- Do not delete `/interactive-learning/control-workbench`.
- Do not delete `/interactive-learning/multi-representation-linkage`; it remains a compatibility route.
- Do not change Arena task-to-workbench routing or official submission behavior.
- Do not redesign interactive course cards or ResourceNode-backed future navigation.

## Decisions

### Replace profile in the core entry model

Update `STUDENT_CORE_ENTRY_IDS` and the `student-profile` entry role in the shared navigation source so `/interactive-learning` becomes the sixth core entry. This is preferable to adding a seventh homepage card because the product model explicitly uses six core student destinations, and profile is already available through identity surfaces.

### Keep profile as an account and cockpit destination

The UserMenu, Arena shell right-side profile link, and direct `/profile` route should remain. This separates identity/account navigation from learning-module navigation without breaking existing profile URLs.

### Remove the hard-coded workbench card from cross-domain exploration

The cross-domain page should render dynamic `FUN_EXPLORATION` resources only. The current hard-coded workbench card should be removed rather than retitled because the workbench is already represented at the homepage level and in Arena challenge flows.

### Preserve compatibility surfaces

`/interactive-learning/multi-representation-linkage` remains available for old direct links and internal fallback behavior. The change only removes public catalog promotion of that legacy surface.

## Risks / Trade-offs

- [Risk] Tests and specs still assume profile is a core navigation entry. -> Mitigation: update navigation, homepage/dashboard, and Arena shell tests to assert profile through account surfaces instead of the core entry list.
- [Risk] Removing the cross-domain workbench card could leave an empty page if no `FUN_EXPLORATION` resources are seeded. -> Mitigation: keep seed/resource expectations for Control Odyssey and Ten Drops, and verify the empty state remains clear.
- [Risk] Users may still need free workbench exploration. -> Mitigation: keep Control Workbench as a homepage core entry and preserve its free-explore URL alias.
