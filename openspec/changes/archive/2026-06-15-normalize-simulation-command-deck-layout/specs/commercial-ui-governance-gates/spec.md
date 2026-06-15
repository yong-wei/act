## ADDED Requirements

### Requirement: Simulation command-deck geometry is governed
Commercial UI governance SHALL reject simulation detail evidence that retains duplicate scene chrome, misaligned panels, or cruise-only scene geometry drift.

#### Scenario: Simulation detail evidence is evaluated
- **WHEN** visual QA evaluates a migrated `/simulations/*` detail route
- **THEN** evidence SHALL prove that the scene does not show resource-local "返回上一层" controls or right-top abbreviations
- **AND** left and right local panels SHALL be top-aligned within the command-deck workspace
- **AND** bottom tools, hints, and shared Konling dock SHALL not overlap the panels or primary scene controls.

#### Scenario: Cruise evidence is evaluated
- **WHEN** visual QA evaluates `/simulations/cruise`
- **THEN** governance SHALL compare it against the other active detail routes and fail if cruise uses a substantially narrower or taller non-scene-first geometry without an approved exception
- **AND** desktop and mobile evidence SHALL show that contextual/evidence content no longer displaces the primary scene from first visual priority.
