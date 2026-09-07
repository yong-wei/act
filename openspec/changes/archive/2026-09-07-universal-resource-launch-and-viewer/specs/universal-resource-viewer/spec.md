## ADDED Requirements

### Requirement: Launch target resolution covers every projected resource type
The teaching launch-target map SHALL resolve a launch target for every projected resource type — lesson, handout, step, video, audio, exercise, card, infographic, textbook, and simulation — using only existing routes, existing launcher contracts, or an explicit viewer-shell target. Video and audio resources SHALL resolve to their owning lesson entrance, carrying a media anchor when one exists. Exercise resources SHALL resolve through a manifest-level step mapping onto the existing step launch contract when that mapping exists; otherwise they SHALL resolve to the owning lesson entrance when a lesson identity can be parsed from the resource, and SHALL NOT invent a step identity. Simulation resources SHALL resolve to their Arena task page, Control Odyssey route, or the generic `/interactive-learning/resources/<id>` route by exact resource origin, including Odyssey level identities. Textbook section resources SHALL resolve through the textbook reader href builder and the book id alias table. A book-level textbook, a chapter locator without a reader unit path, or any resource whose target cannot be resolved exactly SHALL remain unavailable; a route MUST NOT be invented from a Canonical Object identity.

#### Scenario: Bound video resolves to its lesson entrance
- **WHEN** a bound video or audio resource has a resolved lesson identity
- **THEN** the launch-target map SHALL emit the lesson entrance route for that resource
- **AND** it SHALL carry the validated media anchor when the projection provides one

#### Scenario: Bound exercise resolves through the step contract
- **WHEN** a bound exercise resource has a manifest-level step mapping
- **THEN** the launch-target map SHALL emit the existing student demo step route carrying that step identity

#### Scenario: Bound exercise without a step mapping uses the lesson entrance
- **WHEN** a bound exercise resource has no step mapping but a lesson identity can be parsed from the resource
- **THEN** the launch-target map SHALL emit the lesson entrance route
- **AND** it SHALL NOT invent a step identity

#### Scenario: Bound Odyssey level resolves to Control Odyssey
- **WHEN** a bound simulation resource identity is an Odyssey level
- **THEN** the launch-target map SHALL emit the existing Control Odyssey route

#### Scenario: Bound simulation resolves by exact origin
- **WHEN** a bound simulation resource originates from an Arena task, a Control Odyssey level, or a registry component
- **THEN** the launch-target map SHALL emit the corresponding Arena task page, Odyssey route, or generic resource route
- **AND** it SHALL NOT derive a simulation route from the bound Canonical Object identity

#### Scenario: Bound card resolves to the viewer shell
- **WHEN** a bound knowledge card resource has no full-page route of its own
- **THEN** the launch-target map SHALL mark it for in-shell opening instead of emitting a page href
- **AND** the resource SHALL remain launchable from the inspector

### Requirement: The viewer shell dispatches to existing renderers only
The universal resource viewer SHALL be a single shared shell component that opens as a modal dialog and dispatches each resource to its existing renderer: registry components and static text or media resources to the established resource renderer, knowledge cards to the existing Knowledge Card component, infographs to the existing image viewer with zoom, textbooks to the embedded textbook reader, and simulations to their existing simulation surface or their full-page route. The shell SHALL NOT embed, recreate, or replace any resource runtime of its own.

#### Scenario: Registry resource opens in the shell
- **WHEN** a registry component or static text or media resource is opened through the viewer shell
- **THEN** the shell SHALL render it with the established resource renderer
- **AND** audio media SHALL render through the static-media audio branch instead of being rejected as unsupported

#### Scenario: Knowledge card opens in the shell
- **WHEN** a knowledge card resource is opened through the viewer shell
- **THEN** the shell SHALL render it with the existing Knowledge Card component
- **AND** the shell SHALL NOT re-implement card layout or review-state handling

#### Scenario: Textbook opens in the shell
- **WHEN** a textbook resource is opened through the viewer shell
- **THEN** the shell SHALL embed the existing textbook reader at the resolved structural coordinate
- **AND** the reader SHALL keep its own navigation, breadcrumb, and adjacent-unit behavior

### Requirement: The viewer shell supports fullscreen and full-page modes
The viewer shell SHALL provide a shell-level Fullscreen API toggle and an open-full-page action that navigates to the opened resource's existing full-page route in normal access mode. When the Fullscreen API is unavailable in the current browser, the shell SHALL hide the fullscreen control while keeping the modal and full-page modes usable. Closing the shell SHALL return focus to the originating entry surface.

#### Scenario: User toggles fullscreen
- **WHEN** the viewer shell is open and the user activates the fullscreen control
- **THEN** the shell SHALL enter or exit fullscreen through the Fullscreen API
- **AND** the dispatched renderer SHALL continue rendering the same resource without remounting its runtime state

#### Scenario: User opens the full page
- **WHEN** the viewer shell is open and the user activates the open-full-page action
- **THEN** the product SHALL navigate to that resource's existing full-page route
- **AND** the shell SHALL close without leaving modal state behind

#### Scenario: Fullscreen API is unavailable
- **WHEN** the current browser does not support the Fullscreen API
- **THEN** the shell SHALL omit the fullscreen control
- **AND** the modal and open-full-page modes SHALL remain available

### Requirement: Entry points share one open API
The graph inspector SHALL open resources through the viewer-shell open API, passing a descriptor that carries the selected binding's human-readable identity, type, title, full-page fallback href, and type-specific payload such as a media anchor, step identity, or textbook coordinate. The path center SHALL mount the same viewer-shell host. Execution nodes whose destination owns a top-level completion contract SHALL keep that existing window or navigation launch path; the path center SHALL NOT isolate those destinations in an iframe. The Konling surfaces SHALL consume the same open API when their wiring lands, without a second viewer implementation.

#### Scenario: Path center launches a destination-control resource
- **WHEN** a learner activates an execution node in the path center that resolves to a destination-control resource
- **THEN** the path center SHALL launch it with the existing top-level window or navigation contract
- **AND** the path center SHALL keep the shared viewer-shell host mounted
- **AND** the path center SHALL NOT load that destination in an iframe

#### Scenario: Konling surface consumes the same API
- **WHEN** a Konling citation or resource panel is wired to open a bound resource
- **THEN** it SHALL call the same viewer-shell open API with the same descriptor shape
- **AND** it SHALL NOT introduce a parallel viewer or duplicate dispatch rules
