## MODIFIED Requirements

### Requirement: Governance rejects legacy navigation without disposition
Commercial UI governance SHALL reject non-home primary routes that retain unregistered page-local navigation or shell systems.

#### Scenario: Non-home route changes
- **WHEN** a primary route other than the homepage changes navigation, shell, breadcrumb, sidebar, or floating controls
- **THEN** governance SHALL verify AppShell or approved workspace shell metadata, or a temporary adapter disposition with removal condition
- **AND** routes with outdated archetype names, unregistered shell frames, or legacy shell without disposition SHALL fail blocking mode.
- **AND** unregistered page-local topbars or page-local sidebars SHALL fail after the owning migration exception expires.

### Requirement: Shell visual evidence covers navigation states
Commercial UI visual evidence SHALL cover expanded, collapsed, and mobile drawer navigation states when a primary workspace shell is changed.

#### Scenario: Workspace shell PR is reviewed
- **WHEN** a PR changes the shared workspace shell or Arena shell
- **THEN** visual evidence SHALL include desktop expanded navigation, desktop collapsed navigation, mobile drawer navigation, light theme, dark theme, and representative first-viewport task visibility
- **AND** collapsed navigation evidence SHALL prove actual rail width, content expansion, accessible route labels, active state, and absence of duplicated visible labels
- **AND** missing evidence for any changed shell state SHALL fail the relevant governance mode.

### Requirement: Visual acceptance matrix is explicit
The system SHALL require commercial UI changes to identify and verify the representative route matrix affected by the change.

#### Scenario: Commercial UI change is reviewed
- **WHEN** a PR changes login/auth, homepage, student cockpit, Interactive Learning, Arena, adaptive learning, profile, Control Workbench, interactive course runtime, teacher analytics, admin governance, or report UI
- **THEN** the review evidence SHALL identify the affected routes
- **AND** it SHALL include desktop and 320px mobile checks for every affected representative route.
- **AND** secondary navigation unification evidence SHALL cover Arena, Control Workbench, Interactive Learning, course catalog, first-hop Interactive Learning destinations, adaptive practice, knowledge graph, and teacher or administrator data-center states unless a route has a narrow active exception.

### Requirement: Navigation role boundaries are governed
Commercial UI governance SHALL verify that role-scoped navigation does not expose operations-only destinations to students.

#### Scenario: Student navigation evidence is checked
- **WHEN** student navigation, student secondary route evidence, or public-to-student entry evidence is generated
- **THEN** governance SHALL reject visible Data Center entries and `/data-center` links.
- **AND** learner record, evidence, or profile destinations SHALL be used for student review flows instead of Data Center.

#### Scenario: Interactive Learning journey evidence is checked
- **WHEN** Interactive Learning entry evidence includes direct links to chapter components or cross-domain exploration
- **THEN** governance SHALL verify those destinations use the same unified shell family or have a narrow active exception.
- **AND** a migrated entry route SHALL NOT be accepted if its first student action falls back to a legacy page-local topbar.

### Requirement: Local tools do not become platform navigation
Commercial UI governance SHALL distinguish platform navigation from local workspace tools.

#### Scenario: Knowledge or data workspace evidence is checked
- **WHEN** knowledge graph, data center, report, or workspace routes expose filters, legends, chapter directories, source selectors, or node panels
- **THEN** those controls SHALL be marked and tested as local tools or panels.
- **AND** local tools SHALL NOT count as platform navigation or introduce a competing shell style.
