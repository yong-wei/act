## Purpose

Define the platform commercial brand language for maritime control learning, including identity, semantic visual roles, brand applications, asset rules, and downstream review expectations.
## Requirements
### Requirement: Brand identity is defined as a maritime control learning system
The platform SHALL define its commercial brand around maritime control, feedback reasoning, mission navigation, evidence, and engineering judgment rather than generic AI education language.

#### Scenario: A new public or student-facing surface is designed
- **WHEN** a homepage, Arena, workbench, adaptive learning, interactive course, profile, or report surface is introduced or redesigned
- **THEN** its visual language SHALL reference the brand concepts of trace, feedback loop, instrument grid, or governed evidence rather than unrelated decorative motifs.

#### Scenario: Brand wording is reviewed
- **WHEN** brand or product copy is introduced on public, student, teacher, admin, or report surfaces
- **THEN** it SHALL describe the platform as a control-learning, mission-navigation, simulation, evidence, or governance system
- **AND** it SHALL NOT rely on generic AI assistant, magic, sparkle, or productivity-booster language as the primary brand idea.

### Requirement: Commercial color roles are semantic
The platform SHALL define commercial brand color roles for maritime canvas, steel surfaces, primary navigation accent, secondary chart accent, warning, success, danger, and muted foreground.

#### Scenario: A component needs visual emphasis
- **WHEN** a UI component needs emphasis, state, or hierarchy
- **THEN** it SHALL use the corresponding commercial color role rather than page-local fuchsia, violet, emerald, amber, cyan, or raw slate palettes.

#### Scenario: Commercial tokens are mapped to platform tokens
- **WHEN** commercial brand tokens are implemented
- **THEN** they SHALL extend or map to existing platform semantic token roles for canvas, surface, raised surface, overlay, foreground, border, action, evidence, privacy, replay, and evaluation state
- **AND** page-local namespaces SHALL either consume those mapped roles or be retired during migration.

#### Scenario: Existing shell namespace is migrated
- **WHEN** `interactive-course-hub-*`, `admin-console-*`, `premium-lesson-*`, or `surface-card` based styling is migrated
- **THEN** the migration SHALL identify whether each namespace maps to commercial canvas, instrument panel, evidence panel, command surface, status surface, or navigation trace
- **AND** it MAY replace the namespace instead of adapting it when adaptation would preserve page-local palette or shell semantics.

### Requirement: Typography supports brand hierarchy and numeric readability
The platform SHALL define a distinctive sans-serif brand stack, Chinese fallbacks, display/body scales, and numeric treatment for metrics and engineering values.

#### Scenario: Metric-heavy UI renders
- **WHEN** Arena scores, workbench parameters, adaptive ability estimates, data center metrics, or report values are displayed
- **THEN** numeric values SHALL use tabular or mono-compatible numeric styling and SHALL align consistently across repeated rows or panels.

#### Scenario: Dense workspace copy renders
- **WHEN** teacher analytics, admin governance, Control Workbench, Arena leaderboard, or report pages render dense information
- **THEN** headings, labels, values, helper text, and captions SHALL use a restrained hierarchy that supports scanning
- **AND** display-scale type SHALL be reserved for true public or entry hero contexts, not compact operational panels.

### Requirement: Logo and identity assets are scalable and abstract
The platform SHALL use a simple, ownable, scalable mark based on trace, feedback loop, control geometry, or measured grid logic.

#### Scenario: The brand mark is used in UI
- **WHEN** the mark appears as favicon, app badge, nav logo, course badge, report watermark, or compact icon
- **THEN** it SHALL remain legible without relying on literal ship illustrations, generic AI sparkles, or complex decorative detail.

#### Scenario: A logo lockup is used in navigation
- **WHEN** the mark appears in the global shell, role shell, login surface, or compact mobile header
- **THEN** the lockup SHALL have compact, horizontal, and mark-only variants
- **AND** each variant SHALL preserve clear space, minimum size, and contrast in light and dark themes.

### Requirement: Brand applications avoid generic AI visual patterns
The platform SHALL reject generic purple-blue AI gradients, random glow blobs, unrelated icon palettes, three-equal-card feature rows as the default, and page-specific shell skins.

#### Scenario: A redesign proposal is reviewed
- **WHEN** a redesigned page introduces visual structure
- **THEN** reviewers SHALL verify that hierarchy comes from brand surfaces, navigation structure, data grouping, and instrument panels rather than decorative card repetition or unrelated gradients.

#### Scenario: Current UI anti-patterns are replaced
- **WHEN** homepage, Arena, workbench, adaptive learning, profile, teacher/admin, or course runtime surfaces are migrated
- **THEN** large decorative gradient backgrounds SHALL be replaced or subordinated to trace, map, chart, instrument, or evidence structure
- **AND** repeated cards SHALL be used only for true repeated items such as challenges, courses, reports, or students, not as the default page-section composition.

#### Scenario: Page-local accents are found
- **WHEN** a route uses fuchsia, violet, emerald, amber, cyan, raw slate, or unrelated image/icon palettes as local styling
- **THEN** the redesign SHALL translate each accent into a commercial role such as navigation trace, chart accent, warning buoy, evidence healthy, evidence risk, muted inactive, or route identity
- **AND** undocumented accent colors SHALL be rejected.

### Requirement: Brand application artifacts define the visual world
The platform SHALL define required brand application artifacts for favicon, app mark, navigation logo, login/auth surface, course badge, Arena badge, workbench instrument chrome, report watermark, and governance snapshot treatments.

#### Scenario: Downstream UI migration begins
- **WHEN** a downstream commercial UI migration starts for student entry, workspace, teacher/admin, or reports
- **THEN** the migration SHALL have access to a brand application reference that shows mark usage, color roles, typography, instrument surfaces, evidence/status treatment, and navigation treatment in one coherent visual world.

#### Scenario: Required artifacts are reviewed
- **WHEN** the commercial brand kit is implemented
- **THEN** it SHALL include favicon, compact app mark, navigation logo, login/auth treatment, course badge, Arena badge, Control Workbench instrument chrome, data-center snapshot treatment, governance snapshot treatment, and report watermark reference
- **AND** each artifact SHALL show light and dark theme behavior or explicitly state why only one theme applies.

#### Scenario: Report watermark is used
- **WHEN** a classroom, Arena, governance, or data-center report is exported, printed, or displayed for review
- **THEN** the watermark SHALL remain low contrast and SHALL NOT obscure metrics, formulas, student names, chart marks, evidence source labels, or accessibility text contrast.

#### Scenario: Data center or governance snapshot is shared
- **WHEN** a data center, teacher insight, admin governance, or evidence snapshot is captured for review
- **THEN** it SHALL show source quality, freshness, privacy scope, and status legend using commercial evidence/status roles.

### Requirement: Iconography and visual assets are governed by brand fit
The platform SHALL define icon family, stroke weight, illustration, image, and texture rules for commercial UI surfaces.

#### Scenario: A new UI surface adds icons or visual assets
- **WHEN** a student-facing, workspace, teacher, admin, or report surface introduces icons, illustrations, background imagery, or texture
- **THEN** the assets SHALL follow the brand icon and visual-asset rules
- **AND** they SHALL NOT mix unrelated icon families, literal maritime clipart, generic AI sparkles, or decorative assets that do not support the surface task.

#### Scenario: Icon family is chosen
- **WHEN** icons are used for commands, navigation, status, tools, course categories, Arena challenges, or governance evidence
- **THEN** the icon family SHALL use a consistent stroke weight and optical size for the surface
- **AND** status icons SHALL be paired with text or accessible labels when color alone would carry meaning.

#### Scenario: Texture is introduced
- **WHEN** chart grid, scanline, bathymetric map, route trace, or paper/report texture is introduced
- **THEN** the texture SHALL be a low-contrast system layer that supports measurement, navigation, evidence, or print identity
- **AND** it SHALL NOT reduce text fit, chart readability, touch target clarity, or export legibility.

### Requirement: Motion supports operational orientation
The platform SHALL define motion rules for commercial surfaces that emphasize route transitions, state changes, panel entry, and evidence updates without decorative distraction.

#### Scenario: State changes animate
- **WHEN** loading, empty, error, evidence update, route return, panel open, or submission state changes
- **THEN** motion SHALL use short transform, opacity, or measured trace transitions
- **AND** dense workspaces SHALL NOT use broad decorative loops, floating shapes, or motion that competes with data scanning.

### Requirement: Existing shells can be removed when they conflict with the brand
The platform SHALL allow later commercial UI migrations to remove or replace unreasonable legacy shell systems instead of permanently adapting them.

#### Scenario: Legacy shell conflicts with commercial hierarchy
- **WHEN** `FeaturePageNav`, `UnifiedTopBar`, `ArenaPageShell`, teacher layout, admin header, interactive-course hub shell, or premium lesson shell conflicts with role navigation, commercial token roles, or instrument/evidence hierarchy
- **THEN** the migration MAY remove or replace that shell
- **AND** it SHALL preserve route behavior, role actions, authentication callback behavior, and required module entries.

### Requirement: Login and authentication surfaces carry brand and callback intent
The platform SHALL define login, embedded login, callback, auth-error, and profile-return treatments as part of the commercial brand system.

#### Scenario: Login opens with profile callback
- **WHEN** a user opens `/login?callbackUrl=%2Fprofile`
- **THEN** the login surface SHALL visibly preserve the return target as a route trace to profile or role cockpit
- **AND** auth errors, loading states, and privacy copy SHALL use commercial status and evidence roles rather than disconnected technical form styling.

#### Scenario: Embedded login appears on the homepage
- **WHEN** the homepage or another entry surface opens an embedded login modal
- **THEN** the modal SHALL reuse the same mark, callback/role destination semantics, status treatment, and privacy assurance as the standalone login surface.

### Requirement: Downstream surface reviews use representative routes
The platform SHALL require downstream commercial UI work to review the brand contract against representative student, workspace, operations, auth, and report surfaces.

#### Scenario: Student and workspace routes are reviewed
- **WHEN** the brand contract is applied or changed
- **THEN** reviewers SHALL check homepage, `/arena`, `/interactive-learning`, `/assessment/adaptive-practice`, and `/interactive-learning/control-workbench` for brand fit, route continuity, nonblank states, and responsive hierarchy.

#### Scenario: Auth, operations, and report routes are reviewed
- **WHEN** the brand contract is applied or changed
- **THEN** reviewers SHALL check `/login?callbackUrl=%2Fprofile`, representative teacher/admin governance workspaces, data center snapshots, and report output use cases for callback preservation, evidence/status semantics, privacy, and export readability.

