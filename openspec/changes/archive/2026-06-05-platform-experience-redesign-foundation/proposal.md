## Why

The 2026-06-04 premium UI series unified many surfaces into a dark commercial shell, but the current product still reads as a shared skin over unrelated page families. The platform now needs a stronger experience architecture: one brand world, one navigation logic, two first-class theme templates, and a migration rule that rejects pages which cannot map to the target framework.

## What Changes

- Define the platform experience thesis as a maritime control-learning operating system rather than a collection of course, simulation, Arena, profile, teacher, and admin pages.
- Define route archetypes for public entry, learning atlas, mission workspace, knowledge/data map, operations console, and report ledger, with learner record handled as a knowledge/data route family.
- Define light and dark visual templates as equal first-class modes: light as engineering chart paper and daylight instrument surfaces; dark as night bridge, low-light instrument, and trace layers.
- Define a navigation hierarchy that separates product orientation, role cockpit, contextual route trace, and local tools.
- Define a three-role journey matrix so student, teacher, and administrator surfaces connect entry, business object, evidence source, next action, and report/governance destination.
- Define canonical archetype names for route inventory, visual QA, and governance, with legacy route-frame names allowed only as temporary aliases with retirement conditions.
- **BREAKING**: UI changes that preserve incompatible legacy shells, page-local navigation, or generic card-page composition cannot pass commercial UI acceptance unless they register a temporary migration exception.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-commercial-brand-language`: adds the named experience thesis, dual visual templates, and anti-template migration rule.
- `platform-design-system-and-shell`: adds route archetype registration and shell conformance requirements.
- `platform-role-navigation`: adds the target navigation hierarchy and role/journey alignment rules.
- `commercial-ui-governance-gates`: adds acceptance rules that reject pages that do not map to the new experience framework.

## Impact

- Affects future redesign work across `src/app/**`, `src/components/platform/**`, `src/components/shared/**`, `src/features/**`, `src/lib/platform-role-navigation.ts`, `src/lib/commercial-ui-governance.ts`, `src/app/globals.css`, and visual QA artifacts.
- Establishes the baseline for the downstream implementation changes in the `platform-experience-redesign` series.
