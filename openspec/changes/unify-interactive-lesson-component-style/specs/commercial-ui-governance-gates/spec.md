## ADDED Requirements

### Requirement: Governance blocks interactive lesson courseware shell drift
Commercial UI governance SHALL reject interactive lesson runtime changes that reintroduce visible shell differences between page title modules and courseware components.

#### Scenario: Courseware shell gate runs
- **WHEN** a change modifies manifest runtime layout, content renderers, activity renderers, visual module renderers, compute panel embedding, or courseware panel CSS
- **THEN** governance SHALL verify that standard courseware components use the same visible exterior as the page title module
- **AND** visible double shells, course-private outer panels, or module-specific wrapper shapes SHALL fail the gate unless a narrow migration exception is documented.

#### Scenario: Courseware inventory gate runs
- **WHEN** a change claims unified interactive lesson component styling
- **THEN** governance SHALL enumerate manifest-first courseware module families covered by the shared shell, spacing, and typography contract
- **AND** the gate SHALL fail if an active manifest-first module family is omitted without a documented migration exception.

### Requirement: Governance blocks page-local courseware spacing overrides
Commercial UI governance SHALL reject page-local code that alters vertical spacing between interactive lesson courseware components outside the shared runtime layout.

#### Scenario: Spacing gate scans courseware runtime code
- **WHEN** a change modifies manifest-first interactive lesson pages, shared layout renderer, content renderer, activity renderer, or visual component renderer files
- **THEN** governance SHALL verify that sibling component spacing is owned by the shared runtime layout
- **AND** page-local `mt-*`, `mb-*`, `space-y-*`, gap wrappers, or equivalent ad hoc spacing used to separate courseware components SHALL fail the gate unless the occurrence is a named internal-spacing primitive or a documented migration exception.

### Requirement: Governance blocks freeform courseware typography
Commercial UI governance SHALL reject renderer-local title and body text sizing for interactive lesson courseware.

#### Scenario: Typography gate scans courseware runtime code
- **WHEN** a change modifies a manifest-first courseware renderer or page title renderer
- **THEN** governance SHALL verify that page titles, module titles, in-module titles, body copy, captions, and controls use registered courseware typography primitives
- **AND** renderer-local `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, or equivalent font-size choices SHALL fail when used for title or body copy instead of the registered primitive
- **AND** compact text sizes SHALL be allowed only through shared caption/control primitives or math-renderer exceptions.

#### Scenario: Rendered hierarchy is audited
- **WHEN** browser or DOM evidence is captured for an interactive lesson page
- **THEN** evidence SHALL identify level 1 page title, level 2 module titles, level 3 in-module titles, and shared body text with semantic heading levels or equivalent ARIA levels
- **AND** the audit SHALL fail if a level 2 title exceeds level 1, a level 3 title exceeds level 2, or body text size differs across ordinary courseware body regions.

### Requirement: Governance requires traceable interactive lesson style evidence
Commercial UI governance SHALL require traceable evidence for interactive lesson style changes.

#### Scenario: Visual evidence matrix is captured
- **WHEN** a change modifies courseware shell, spacing, typography, or shared visual component styling
- **THEN** evidence SHALL include route, role, theme, viewport, component, and state identifiers
- **AND** the evidence set SHALL cover student and teacher routes, light and dark themes, desktop, mobile, and projection-sized viewports, and representative title, figure, derivation, block diagram, signal flow graph, activity, table/rich, and compute states when those states are part of the changed runtime.
