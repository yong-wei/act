## MODIFIED Requirements

### Requirement: Inspector presents only eligible source-owned resource launches
The inspector SHALL group eligible formal resources by visual family while preserving each item's exact runtime subtype, human-readable title, teaching role, semantic anchor summary, availability, and source-owned launch action. It SHALL delegate playback, reading, exercise, simulation, project, and other runtime behavior to existing feature-owned launchers or renderers and SHALL NOT embed or recreate those runtimes inside the drawer. Activating a launch item SHALL open the universal resource viewer shell in place by default instead of navigating the whole page away from the graph; the viewer shell SHALL delegate rendering to the same existing launchers or renderers, and the resource's full-page route SHALL remain reachable through the shell's open-full-page action.

#### Scenario: User launches a bound media paragraph
- **WHEN** an authorized video, audio, or podcast binding has a current semantic-paragraph anchor and safe launch descriptor
- **THEN** the inspector SHALL open the universal resource viewer shell and pass its validated `startSeconds` and source-owned resource identity to the existing player contract
- **AND** it SHALL not construct a route from the Canonical Object identity or implement another player

#### Scenario: User launches bound text or an exercise
- **WHEN** an authorized textbook, card, handout, lecture, or exercise binding has a current atomic anchor
- **THEN** the inspector SHALL open the universal resource viewer shell and pass the stable paragraph or question identity to the existing reader or exercise renderer
- **AND** it SHALL not open only the container start when the governed anchor is more precise

#### Scenario: User continues to the full page
- **WHEN** the viewer shell is open for a launched resource and the user activates the open-full-page action
- **THEN** the product SHALL navigate to that resource's existing full-page route in normal access mode
- **AND** the inspector SHALL NOT replace the graph canvas as a side effect of opening the shell

#### Scenario: Resource launch is not eligible
- **WHEN** a binding is development-only, stale, identity-mismatched, unauthorized, lacks a safe launch target, or its launcher cannot consume the governed atomic anchor
- **THEN** the inspector SHALL omit the formal launch item and the node glyph SHALL omit its marker qualification
- **AND** valid semantic detail and unrelated eligible resources SHALL remain usable
