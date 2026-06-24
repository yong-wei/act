## Why

React Doctor reports real owned-surface accessibility and DOM semantics warnings: 547 missing button types, 171 unlabeled controls, 63 labels without associated controls, 4 videos without captions, and multiple static click targets without keyboard semantics. These are user-facing defects, not scanner noise.

## What Changes

- Fix high-confidence accessibility and DOM warnings on owned application, component, feature, and resource surfaces.
- Prefer semantic controls over role-heavy static elements.
- Add or update focused tests where existing component contracts can prove the behavior.

## Capabilities

### New Capabilities

- `owned-surface-accessibility-semantics`: define warning-level accessibility and DOM semantics remediation requirements.

## Impact

- Affects JSX controls, forms, dialogs, interactive lesson widgets, classroom components, and resource components.
- Does not change scoring, lesson content, simulation math, or AI behavior.
