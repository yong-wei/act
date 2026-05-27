## Why

The role-navigation redesign kept Control Workbench as a first-class student entry, but it also removed the visible Interactive Learning hub from the homepage and student navigation. Personal Center is already available through cockpit and account surfaces, so the sixth core student entry should point to Interactive Learning while legacy multi-representation workbench links are removed from the public interactive catalog.

## What Changes

- Replace the student core `Personal Center` entry with `Interactive Learning`, targeting `/interactive-learning`, while keeping `/profile` available through account, cockpit, and profile-specific links.
- Keep `Control Workbench` as its own homepage and student-shell entry.
- Remove the hard-coded cross-domain `综合仿真工作台` / classic four-view workbench card from `/interactive-learning/cross-domain-exploration`.
- Keep cross-domain exploration focused on `FUN_EXPLORATION` resources such as Control Odyssey and Ten Drops.
- Preserve `/interactive-learning/multi-representation-linkage` as a compatibility route and keep Arena/control-workbench routing behavior unchanged.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `platform-role-navigation`: Student core navigation changes from profile-as-core-entry to interactive-learning-as-core-entry while profile remains an account/cockpit destination.
- `arena-control-workbench-routing`: Cross-domain exploration no longer advertises the upgraded multi-representation/classic workbench as a catalog entry; Control Workbench remains the canonical route for workbench use.

## Impact

- Affects `src/lib/platform-role-navigation.ts`, homepage and dashboard entry rendering, Arena student shell navigation, and related navigation tests.
- Affects `/interactive-learning/cross-domain-exploration` rendering and tests around public interactive-learning catalog entries.
- Does not remove `/profile`, `/interactive-learning/control-workbench`, or `/interactive-learning/multi-representation-linkage`.
