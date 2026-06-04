## ADDED Requirements

### Requirement: Public entry routes preserve destination intent
Public entry routes SHALL preserve destination intent across login, role redirect, cockpit, profile, learning, and simulation entry actions.

#### Scenario: Login opens from a protected destination
- **WHEN** a user opens login with a callback URL
- **THEN** the login entry surface SHALL show the intended destination in route-aware language
- **AND** successful authentication SHALL continue to route to the callback or role cockpit according to existing authorization behavior.

### Requirement: Learning entry navigation uses student intent groups
Learning entry navigation SHALL organize destinations by learn, practice, challenge, experiment, review, and account/profile intent.

#### Scenario: Student opens a learning entry surface
- **WHEN** Interactive Learning, course catalog, or simulation hub renders
- **THEN** the current page context SHALL be clear
- **AND** adjacent learning destinations SHALL remain reachable without duplicating every global product link as primary content.
