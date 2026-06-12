## ADDED Requirements

### Requirement: Teacher and admin operations use operations-console shell
Teacher and administrator operations routes SHALL converge on the operations-console archetype for role navigation, object context, pending work, status semantics, and shared dock behavior.

#### Scenario: Operations route renders
- **WHEN** teacher home, teacher analytics, teacher resources, admin home, admin users, admin config, admin states, or admin governance routes render after migration
- **THEN** the route SHALL preserve role operations navigation, current object or work context, next actions, risks, and account/cockpit semantics through the unified shell
- **AND** page-local shells SHALL not compete with the operations-console navigation language.

### Requirement: Operations surfaces expose unavailable future data honestly
Teacher and admin operations UI SHALL represent unavailable analytics, model, overlay, or governance data as explicit loading, disabled, feature-flagged, or unsupported states.

#### Scenario: Future data is not available
- **WHEN** class analytics, student analytics, model governance, runtime overlay state, or system health data is missing
- **THEN** the UI SHALL show an honest unavailable or pending state with permitted adjacent actions
- **AND** it SHALL NOT fabricate metrics or hide missing capability behind decorative placeholders.
