## ADDED Requirements

### Requirement: Virtual simulation brand uses Product Design handoff as visual reference
Virtual simulation surfaces SHALL use the confirmed Product Design handoff and concept images as the visual reference for premium Instrument Atlas expression.

#### Scenario: Simulation visual design is reviewed
- **WHEN** `/simulations`, `/simulations/*`, or simulation mission surfaces are redesigned
- **THEN** visual evidence SHALL compare the implementation against the accepted elements in `concept-1-platform-continuity.png`, `concept-2-command-deck-shell.png`, and `concept-3-learning-mission-studio.png`
- **AND** the comparison SHALL be governed by `design-handoff.md`, including its rejected model-status, role-switching, and duplicate-assistant details
- **AND** token usage alone SHALL NOT be sufficient to pass visual acceptance.

### Requirement: Simulation visual quality reaches handoff target
Virtual simulation pages SHALL express a high-quality commercial teaching platform and immersive control-console character without becoming a marketing hero page or game HUD.

#### Scenario: Simulation screenshots are reviewed
- **WHEN** visual evidence is captured for the simulation catalog and representative detail pages
- **THEN** reviewers SHALL verify clear hierarchy, mature spacing, controlled 8px-or-less component radius unless system components require otherwise, readable translucent panels, consistent controls, and a visible learning or simulation task
- **AND** pages SHALL fail acceptance if they remain generic card grids, opaque administration panels, decorative gradients, or disconnected technical demos.
