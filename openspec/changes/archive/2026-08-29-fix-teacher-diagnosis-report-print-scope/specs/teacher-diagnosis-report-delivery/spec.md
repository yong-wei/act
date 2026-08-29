## ADDED Requirements

### Requirement: Browser print outputs only the report deliverable

The teacher delivery surface SHALL scope browser print output to the report deliverable itself: the report title, notice, metadata, summary, findings, evidence summaries, suggestions, limitations, and version footer. The platform shell chrome SHALL be excluded from print output, including breadcrumbs, workspace title and subtitle, theme switcher, user menu, platform navigation sidebar, mobile navigation and its drawer entry, workspace command-bar tab rows, and floating web-only controls. Browser-generated print headers and footers remain owned by the browser settings and SHALL NOT be suppressed or replaced by the application. Normal on-screen navigation and interactions SHALL be unchanged.

#### Scenario: Teacher prints the fixed report from Edge

- **WHEN** an authorized teacher opens the teacher delivery page in Edge and invokes the browser print preview
- **THEN** the preview SHALL contain the report deliverable content and preserve the browser-generated date and site-title header
- **AND** the preview SHALL NOT contain the app shell chrome, navigation tabs, user menus, the print button, the sidebar, or other web-only controls.

#### Scenario: Report content paginates

- **WHEN** the report deliverable content spans multiple printed pages
- **THEN** the content SHALL paginate without occlusion, horizontal clipping, or truncation of key report content.

#### Scenario: Screen presentation is unchanged

- **WHEN** the teacher browses the delivery page without printing
- **THEN** the platform shell navigation, header, and workspace tabs SHALL render exactly as before
- **AND** no new export entry point SHALL be introduced.
