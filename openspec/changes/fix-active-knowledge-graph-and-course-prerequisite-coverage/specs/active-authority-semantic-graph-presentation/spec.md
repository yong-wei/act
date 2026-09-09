## ADDED Requirements

### Requirement: Visible Active layouts remain fixed until explicit manipulation
After initial presentation the Active renderer SHALL preserve every initialized node position and the current camera through hover, selection, detail opening/closing, filters, localization and asynchronous data. It SHALL preserve separate complete layouts and camera poses by Authority/catalog, domain and dimension. New disclosed nodes SHALL be placed without moving existing nodes. Viewport resize SHALL NOT automatically fit the graph. Initial entry, first use of a dimension, explicit fit and explicit relayout are the only automatic initialization exceptions; user dragging, zooming, panning and 3D orbit remain available.

#### Scenario: Hover and filter an initialized graph
- **WHEN** the learner repeatedly hovers, selects, filters and restores nodes
- **THEN** existing world coordinates and camera pose SHALL remain unchanged
- **AND** restored nodes SHALL reuse their prior positions

#### Scenario: Disclose a neighbor
- **WHEN** a new one-hop response arrives
- **THEN** only new nodes SHALL receive initial positions and the visible canvas SHALL remain available

### Requirement: Active 3D layouts occupy a volume
Both root and domain 3D layouts SHALL use three-dimensional seeds and collision geometry with meaningful depth relative to the graph's horizontal and vertical extent, rather than a planar layout with small Z jitter. Initialization SHALL finish before the stable first frame.

#### Scenario: View a large disconnected domain in 3D
- **WHEN** the domain has no currently displayed edges
- **THEN** its nodes SHALL occupy a stable volume and SHALL NOT form a thin rectangular sheet

### Requirement: Active context and selected semantic text are always visible
The graph SHALL display the current domain and view scope. The detail header SHALL immediately display the selected human-readable name and type during loading, success and failure. Missing rich text SHALL fall back to the same-locale plain text; unavailable optional resources SHALL NOT hide base semantics. All bottom coverage text SHALL be left-aligned.

#### Scenario: Detail contains missing rich text
- **WHEN** the response contains a plain name and description and rich projections with state missing
- **THEN** the detail and hover SHALL show the plain name and description
- **AND** closing the detail SHALL NOT navigate or reset the graph

### Requirement: One prerequisite filter preserves published provenance
The graph SHALL provide one default-enabled prerequisite filter for published teaching prerequisites and direct Engineering prerequisites. Equivalent edges SHALL display once with retained source and strength. Containment and association SHALL retain their own semantics. A missing publication SHALL be distinguished from a valid empty publication.

#### Scenario: The same prerequisite has teaching and engineering sources
- **WHEN** both sources are published
- **THEN** one filter SHALL control their shared display without dropping provenance or changing direction

### Requirement: Connected knowledge occupies the center with distributed peripheral isolates
Initial 2D and 3D domain layouts SHALL place connected nodes centrally and distribute isolated nodes uniformly around them. An entirely disconnected graph SHALL use a uniform disk or volume. No isolated-node matrix or separate one-sided block SHALL be used.

#### Scenario: Enter a mixed connected and isolated domain
- **WHEN** the graph initializes or the user explicitly requests relayout
- **THEN** connected nodes SHALL be central and isolated nodes SHALL be distributed around the central group in both dimensions

### Requirement: Selection focus and filter presentation are consistent
Selection SHALL highlight the selected node, its directly connected nodes and incident relations, dim nodes and relations outside that focus group, and hide labels outside that group until a canvas-background click clears focus. Default node types SHALL include only DomainConcept. A multi-select type menu SHALL open upward. An upward multi-select Node resources menu SHALL reuse the existing system resource types and published resource bindings matched to the selected Authority. Resource-type metadata SHALL NOT grant launch authorization; direct registry launches SHALL retain ownership and capture validation, while published-resource references SHALL be revalidated by their owning publication reader. Selected resource types SHALL match by OR and combine with object types by AND; an empty resource-type selection SHALL mean no resource restriction. Legend colors, line patterns and direction markers SHALL match both renderers.

#### Scenario: Focus and clear a selected node
- **WHEN** a node is selected and then the background is clicked
- **THEN** focus SHALL clear and normal labels and emphasis SHALL return without changing saved coordinates or camera

#### Scenario: Filter multiple resource types and object types
- **WHEN** the user selects types in the upward menu and selects resource types
- **THEN** only nodes meeting both selections SHALL be shown, using the Authority-matched published binding evidence

#### Scenario: Published resource type remains discoverable during app capture drift

- **WHEN** a published resource binding matches the selected Authority but the application registry capture is dirty or differs
- **THEN** its learner-visible resource type SHALL remain eligible for filtering; direct registry launches SHALL remain blocked, and published-resource references MAY open only after their own matching publication and content-version validation
