# commercial-ui-governance-gates Specification

## Purpose
Define automated and review-based governance gates that protect commercial UI consistency across platform tokens, shells, navigation, module chrome, visual acceptance evidence, accessibility, and text fit.
## Requirements
### Requirement: Commercial UI governance has advisory and blocking modes
The system SHALL support advisory and blocking governance modes for commercial UI rules so migrations can report legacy debt before strict enforcement begins.

#### Scenario: Governance runs during migration
- **WHEN** a commercial UI governance check runs while allowlisted legacy debt remains
- **THEN** advisory mode SHALL report the violation and owning migration reference
- **AND** blocking mode SHALL fail only new or unallowlisted violations according to the migration stage.

#### Scenario: Default test encounters commercial UI debt
- **WHEN** the default project test command includes commercial UI governance
- **THEN** any failure for `/` or another primary route SHALL be treated as real UI governance debt unless it has a narrow temporary exception
- **AND** dependency-upgrade work SHALL NOT classify that failure as package noise.

### Requirement: Token governance rejects unapproved page-local palettes
The system SHALL detect unapproved page-local color families, raw decorative gradients, and unregistered status colors in student-facing and workspace UI.

#### Scenario: New UI introduces a local color system
- **WHEN** a new or migrated student-facing page, workspace, shell, panel, or module uses raw hex colors, unregistered Tailwind color families, or page-local gradient systems outside approved primitives
- **THEN** the governance gate SHALL fail or report the violation according to the current enforcement mode.

### Requirement: Shell governance requires registered route frames
The system SHALL require primary student, workspace, teacher, and admin route frames to use registered platform or commercial workspace shells.

#### Scenario: A new route introduces its own header shell
- **WHEN** a route adds or changes a primary page frame, top bar, side bar, breadcrumb area, or account action surface
- **THEN** the governance gate SHALL verify that the route uses a registered shell or a documented migration exception.

### Requirement: Visual review checks commercial hierarchy
The system SHALL require review evidence for brand fit, visual hierarchy, responsive layout, first-viewport usefulness, and dense-workspace task visibility when commercial UI surfaces are changed.

#### Scenario: A PR changes a commercial UI surface
- **WHEN** a PR changes homepage, student cockpit, Interactive Learning, Arena, adaptive learning, profile, Control Workbench, interactive course runtime, teacher analytics, or admin governance UI
- **THEN** the review checklist SHALL include visual evidence or screenshots for desktop and mobile
- **AND** reviewers SHALL check for generic AI gradients, decorative card repetition, incoherent navigation hierarchy, hidden primary tasks, and text overlap.

### Requirement: Governance allowlists are explicit and temporary
The system SHALL keep commercial UI governance allowlists explicit, scoped, dated, and tied to migration changes.

#### Scenario: A legacy violation is allowed during migration
- **WHEN** a known legacy page violates a commercial UI rule
- **THEN** the allowlist entry SHALL name the path, violated rule, owning migration change or issue, and removal condition
- **AND** new unrelated violations SHALL NOT be covered by that allowlist.

### Requirement: Visual acceptance matrix is explicit
Commercial UI governance SHALL include a competition surface matrix for final submission readiness.

#### Scenario: Competition surface evidence is reviewed
- **WHEN** a PR changes final competition surfaces or assets
- **THEN** evidence SHALL include the affected teacher, student, administrator, grading, diagnosis, path, prep-pack, effect-report, simulation or Arena, and entry routes
- **AND** each required route SHALL include 1440px desktop and 320px mobile evidence in light and dark themes where supported
- **AND** missing evidence SHALL fail final competition readiness unless a narrow documented exception exists.

### Requirement: Accessibility and text-fit gates protect commercial quality
The system SHALL require commercial UI changes to satisfy contrast, visible focus, keyboard reachability, reduced-motion, button text-fit, and mobile text-overlap criteria.

#### Scenario: A commercial UI surface is changed
- **WHEN** the surface contains navigation, buttons, forms, panels, charts, cards, module prompts, or status labels
- **THEN** text SHALL remain readable at desktop and 320px mobile widths
- **AND** keyboard focus SHALL be visible
- **AND** button labels SHALL not wrap incoherently
- **AND** foreground/background contrast SHALL meet the project accessibility threshold.

### Requirement: Visual QA covers theme parity and floating controls
Commercial UI governance SHALL require representative screenshot evidence for light theme, dark theme, responsive layout, and floating action dock placement when primary route frames are changed.

#### Scenario: A primary shell migration is reviewed
- **WHEN** a PR changes AppShell, route navigation, floating action dock, homepage, login, Interactive Learning, simulation, Control Workbench, learner profile, teacher, admin, or knowledge graph UI
- **THEN** visual evidence SHALL include representative desktop and 320px mobile screenshots in both light and dark themes where the route supports theme switching
- **AND** the evidence SHALL show that Konling and management/settings controls do not overlap page content, local toolbars, or each other.

### Requirement: Background browser capture is an accepted review method
The system SHALL allow background Playwright or equivalent browser capture as the default visual verification method for local UI review.

#### Scenario: Visual QA runs locally
- **WHEN** a UI migration needs visual evidence
- **THEN** the reviewer MAY use background browser automation against the local dev server to capture route screenshots without depending on Codex window size
- **AND** the captured artifacts SHALL identify route, theme, viewport, authentication role, and timestamp or run id.

### Requirement: Commercial UI acceptance requires archetype conformance
Commercial UI governance SHALL reject primary route migrations that cannot demonstrate conformance to the registered experience archetype.

#### Scenario: A redesigned page is reviewed
- **WHEN** a PR changes a primary UI route
- **THEN** review evidence SHALL name the route archetype, supported navigation layers, light/dark template behavior, mobile behavior, and first-viewport primary task
- **AND** the page SHALL fail acceptance if it only adds platform tokens, borders, screenshots, or `data-commercial-*` markers without matching the archetype.

### Requirement: Temporary exceptions are narrow and scheduled for removal
Commercial UI governance SHALL allow temporary exceptions only for legacy pages that cannot be migrated in the current change.

#### Scenario: A legacy shell remains
- **WHEN** a primary route keeps an incompatible legacy shell or local navigation pattern
- **THEN** the exception SHALL name the route, violated archetype rule, owning downstream issue, and removal condition
- **AND** the exception SHALL NOT cover newly introduced UI.

### Requirement: Experience acceptance rejects template-only composition
Commercial UI governance SHALL reject route migrations that use the new vocabulary without demonstrating route continuity, non-template composition, mobile behavior, and theme parity.

#### Scenario: A migrated route is accepted
- **WHEN** a primary route migration is reviewed
- **THEN** the evidence SHALL show non-template composition tied to the declared archetype, continuity from prior route or role entry to next action, desktop and 320px mobile behavior, and light/dark theme parity where theme switching is supported
- **AND** screenshots, `data-commercial-*` markers, token usage, borders, or repeated card sections SHALL NOT be sufficient acceptance evidence on their own.

### Requirement: Decorative entry pages fail role-journey acceptance
Commercial UI governance SHALL reject entry pages that do not connect to a role journey, current task, evidence state, or next action.

#### Scenario: A public or role entry page is reviewed
- **WHEN** homepage, login, dashboard, Interactive Learning entry, student cockpit, teacher entry, or admin entry is redesigned
- **THEN** the page SHALL identify its role journey, business object or learning object, relevant evidence or status state, next action, and downstream report or governance destination when applicable
- **AND** decorative hero sections, atmospheric imagery, isolated feature grids, or metrics without role action SHALL fail acceptance unless registered as a temporary migration exception.

### Requirement: Governance enforces route ledger and archetype conformance
Commercial UI governance SHALL verify primary route ledger coverage and archetype conformance.

#### Scenario: UI route changes
- **WHEN** a PR changes a primary UI route or shared shell
- **THEN** governance SHALL verify the route has ledger metadata, owning change, archetype, theme support, navigation layers, and dock behavior
- **AND** the route SHALL fail blocking mode if it lacks required metadata after migration.

### Requirement: Governance rejects legacy navigation without disposition
Commercial UI governance SHALL reject non-home primary routes that retain unregistered page-local navigation or shell systems.

#### Scenario: Non-home route changes
- **WHEN** a primary route other than the homepage changes navigation, shell, breadcrumb, sidebar, or floating controls
- **THEN** governance SHALL verify AppShell or approved workspace shell metadata, or a temporary adapter disposition with removal condition
- **AND** routes with outdated archetype names, unregistered shell frames, or legacy shell without disposition SHALL fail blocking mode.

### Requirement: Visual evidence includes structured route metadata
Commercial UI visual evidence SHALL include structured route metadata.

#### Scenario: Screenshot evidence is captured
- **WHEN** visual QA artifacts are produced
- **THEN** each artifact manifest SHALL identify route, archetype, theme, viewport, auth state, role state, dock state, first-viewport task visibility, and result
- **AND** missing or stale metadata SHALL fail the relevant governance mode.

### Requirement: Visual evidence capture completeness is enforced
Commercial UI governance SHALL detect when requested visual evidence routes or states were not captured.

#### Scenario: Visual QA route matrix is executed
- **WHEN** the visual QA manifest requests multiple routes, themes, viewports, or role states
- **THEN** governance SHALL compare requested evidence with produced artifacts
- **AND** missing captures, stale captures, route inventory drift, or visual QA matrix drift SHALL fail the relevant governance mode.

### Requirement: Mobile quality gates reject desktop squeeze-down
Commercial UI governance SHALL reject mobile layouts that merely squeeze desktop sidebars, filters, or workbench panels into the viewport.

#### Scenario: 320px mobile evidence is reviewed
- **WHEN** primary route mobile evidence is evaluated
- **THEN** permanent sidebars, filter panels, and configuration blocks SHALL not hide the primary task or canvas
- **AND** drawer, sheet, tab, or command surfaces SHALL preserve reachability of secondary controls.

### Requirement: Dock and local controls do not collide
Commercial UI governance SHALL validate shared dock behavior across workspaces and report surfaces.

#### Scenario: Dock evidence is reviewed
- **WHEN** Konling, issue badge, settings, management, page tools, support drawers, or report/export controls are visible
- **THEN** evidence SHALL show safe-area, z-index, keyboard reachability, and non-overlap at 1440px and 320px
- **AND** separate right-bottom fixed systems SHALL fail blocking mode after dock migration.

### Requirement: Report/export evidence is governed
Commercial UI governance SHALL validate report and export readability where report-ledger surfaces are changed.

#### Scenario: Report-ledger surface changes
- **WHEN** report, snapshot, print, or export UI changes
- **THEN** evidence SHALL show watermark, privacy labels, source labels, charts, tables, formulas, and key metrics remain readable
- **AND** unavailable data SHALL be represented as honest status, not fabricated output.

### Requirement: Governance enforces centralized workspace assets
Commercial UI governance SHALL require primary workspace visual assets to be stored in registered platform visual-world directories with narrow ownership and route usage metadata.

#### Scenario: Workspace UI adds visual assets
- **WHEN** a PR adds or changes generated images, SVGs, thumbnails, textures, or illustrations for Arena or another primary workspace
- **THEN** review evidence SHALL identify the centralized asset directory, affected routes, intended usage, and fallback behavior
- **AND** page-local scattered asset folders SHALL fail governance unless a temporary exception names the owning migration and removal condition.

### Requirement: Governance rejects emoji-based premium identity
Commercial UI governance SHALL reject emoji as functional or premium identity symbols in migrated primary workspaces.

#### Scenario: Migrated workspace UI is reviewed
- **WHEN** a PR changes navigation, cards, status modules, empty states, or task-entry UI for a migrated primary workspace
- **THEN** review SHALL confirm that module identity and status signals use approved icons, text, status semantics, or centralized visual assets
- **AND** emoji SHALL NOT be used as route icons, status icons, module symbols, or decorative premium identifiers.

### Requirement: Shell visual evidence covers navigation states
Commercial UI visual evidence SHALL cover expanded, collapsed, and mobile drawer navigation states when a primary workspace shell is changed.

#### Scenario: Workspace shell PR is reviewed
- **WHEN** a PR changes the shared workspace shell or Arena shell
- **THEN** visual evidence SHALL include desktop expanded navigation, desktop collapsed navigation, mobile drawer navigation, light theme, dark theme, and representative first-viewport task visibility
- **AND** collapsed navigation evidence SHALL prove actual rail width, content expansion, accessible route labels, active state, and absence of duplicated visible labels
- **AND** missing evidence for any changed shell state SHALL fail the relevant governance mode.

### Requirement: Unified UI governance validates route ownership and shell disposition
Commercial UI governance SHALL validate route ledger ownership, canonical archetype conformance, and legacy shell disposition for unified UI migrations.

#### Scenario: Migrated route is checked
- **WHEN** a route is marked migrated or changed by the unified UI series
- **THEN** governance SHALL verify canonical archetype, owning change, theme support, dock behavior, visual QA profile, and legacy shell disposition
- **AND** missing metadata, duplicate ownership, unowned aliases, or page-local navigation reintroduction SHALL fail according to the current enforcement mode.

#### Scenario: Legacy shell remains temporarily
- **WHEN** a migrated route keeps a legacy shell, local topbar, sidebar, breadcrumb, or fixed control
- **THEN** the exception SHALL name route, violated rule, owner, reason, expiry or removal condition, and downstream issue
- **AND** the exception SHALL not cover new unrelated UI.

### Requirement: Unified UI visual evidence is structured and complete
Commercial UI governance SHALL require structured visual evidence for migrated route families.

#### Scenario: Visual evidence is captured
- **WHEN** visual QA artifacts are produced for a unified UI migration
- **THEN** each artifact SHALL identify route, archetype, theme, viewport, auth state, role state, dock state, navigation state, first-viewport task visibility, timestamp or run id, and result
- **AND** governance SHALL compare requested evidence with produced artifacts and fail missing, stale, or mismatched entries according to enforcement mode.

#### Scenario: Shell states are reviewed
- **WHEN** a shared shell, mission workspace, learner/knowledge/data surface, operations console, or report ledger is changed
- **THEN** evidence SHALL cover the applicable light theme, dark theme, desktop expanded navigation, desktop collapsed navigation, mobile drawer, 320px mobile layout, dock non-overlap, and first-viewport task visibility states.

### Requirement: Navigation role boundaries are governed
Competition visual evidence SHALL preserve role-scoped navigation boundaries.

#### Scenario: Student competition evidence is checked
- **WHEN** student screenshots or DOM evidence are generated for the competition package
- **THEN** visible navigation SHALL NOT include Data Center
- **AND** review, evidence, diagnosis, and growth actions SHALL target learner-record routes.

### Requirement: Local tools do not become platform navigation
Competition surfaces SHALL preserve unified navigation while allowing local analytical tools.

#### Scenario: Report or workspace evidence is checked
- **WHEN** effect report, data provenance, knowledge, Arena, or control-workbench evidence is generated
- **THEN** filters, legends, source selectors, and local inspectors SHALL be marked as local tools
- **AND** they SHALL NOT introduce a competing shell or platform navigation pattern.

### Requirement: React Doctor error checks remain local
Commercial UI governance SHALL support local-only React Doctor error-level checks for migrated UI surfaces without requiring GitHub Actions.

#### Scenario: Migrated UI is validated locally
- **WHEN** a developer validates migrated UI surfaces before commit or review
- **THEN** the local check SHALL report React Doctor error-level findings for the affected routes or representative route set
- **AND** the project SHALL not add GitHub Actions integration for this check unless CI quota constraints are explicitly changed.

### Requirement: Knowledge graph visual QA blocks unreadable graph regressions
Commercial UI governance SHALL verify that the knowledge graph satisfies the approved visual grammar, compact tool behavior, and readability evidence before accepting it as migrated.

#### Scenario: Knowledge graph route is checked
- **WHEN** governance checks `/knowledge`
- **THEN** the checks SHALL verify collapsed default local tools, graphical relation legend samples, localized filter labels, bounded node scaling, fine-line relation styles, active filter summaries, and selected-node preservation across tool open and close
- **AND** text-only legends, raw schema labels, permanent desktop chapter/filter/legend/resource panels, or all-edge tangle defaults SHALL fail or be reported according to governance mode.

#### Scenario: Runtime relation coverage is checked
- **WHEN** governance checks knowledge graph visual semantics
- **THEN** the checks SHALL read the runtime knowledge graph relation types and verify each type has a mapped Chinese label, visual family, direction semantics, density policy, and legend explanation
- **AND** unmapped runtime relation types SHALL fail the check or be reported as blocking coverage gaps.

### Requirement: Simulation visual QA matrix is required
Commercial UI governance SHALL require structured visual evidence for virtual simulation catalog, compatibility route, representative detail pages, and related mission workspaces.

#### Scenario: Simulation UI migration is reviewed
- **WHEN** a PR changes `/simulations`, `/virtual-lab`, `/simulations/*`, or simulation-related mission shell behavior
- **THEN** evidence SHALL include `/simulations`, the final `/virtual-lab` behavior, at least one heading-control simulation, at least one DP/positioning simulation, `/simulations/cruise`, and `/interactive-learning/control-workbench` regression coverage
- **AND** evidence SHALL include light theme, dark theme, desktop navigation states, 320px mobile behavior, dock state, local-tool state, and first-viewport task visibility where applicable.

### Requirement: Simulation Product Design handoff alignment is governed
Commercial UI governance SHALL require virtual simulation UI implementations to prove alignment with the Product Design handoff before final simulation visual QA.

#### Scenario: Handoff-aligned simulation implementation is reviewed
- **WHEN** a PR implements simulation UI alignment
- **THEN** evidence SHALL include screenshots for `/simulations`, at least one heading-control detail page, at least one DP/positioning detail page, `/simulations/cruise`, and `/interactive-learning/control-workbench` regression where applicable
- **AND** each representative route SHALL identify the handoff section and concept image used as the visual/layout reference
- **AND** evidence SHALL state the selected `/virtual-lab` compatibility role and prove it does not conflict with `/simulations`
- **AND** evidence SHALL include the Control Workbench or course-embedded Concept 3 sample with both available-data and missing-data behavior where the route can produce those states
- **AND** missing handoff-source references SHALL fail acceptance.

### Requirement: Simulation handoff visual verification uses subagent review
The implementation SHALL use an independent subagent visual verification pass before acceptance.

#### Scenario: Visual verification is performed
- **WHEN** implementation screenshots and evidence are ready
- **THEN** a subagent SHALL be given `design-handoff.md`, the three concept image paths, and the produced implementation screenshots
- **AND** the subagent SHALL report pass/fail findings for accepted catalog structure, `/virtual-lab` compatibility role, accepted command-deck composition, accepted learning mission semantics, rejected model-status columns, rejected role switches, rejected duplicate assistant panels, dock non-overlap, keyboard-reachable collapse controls, mobile reachability, contrast, and theme parity
- **AND** unresolved blocking subagent findings SHALL prevent the change from being marked complete.

### Requirement: Simulation evidence proves nonblank mission workspace
Simulation visual evidence SHALL prove that the primary scene, chart, canvas, or instrument area is visible and nonblank.

#### Scenario: Simulation screenshot is captured
- **WHEN** visual evidence is captured for a simulation detail route
- **THEN** the evidence SHALL show a nonblank primary simulation or instrument area
- **AND** it SHALL show that bottom toolbar, side panels, hints, and shared dock do not overlap primary controls or obscure the scene.

### Requirement: Simulation information architecture regressions are governed
Commercial UI governance SHALL reject simulation routes that reintroduce conflicting availability truth or internal model-status language for students.

#### Scenario: Simulation entry route is checked
- **WHEN** governance checks student-facing simulation entry routes
- **THEN** `/virtual-lab` SHALL NOT display an availability count that conflicts with `/simulations`
- **AND** student-facing catalog surfaces SHALL NOT show internal model deployment or version status as primary learning information.

### Requirement: Simulation assistant and local controls use one dock model
Commercial UI governance SHALL reject duplicate assistant systems and unmanaged right-bottom fixed controls on simulation routes.

#### Scenario: Simulation route exposes assistant support
- **WHEN** Konling or assistant support is available on a simulation route
- **THEN** it SHALL be registered through the shared dock model
- **AND** duplicate page-local assistant panels, unmanaged settings buttons, or separate right-bottom fixed control systems SHALL fail governance after migration.

### Requirement: Simulation React Doctor checks remain local
Simulation UI governance SHALL support local-only React Doctor error-level checks for affected simulation routes.

#### Scenario: Simulation UI is validated locally
- **WHEN** a developer validates simulation UI changes
- **THEN** local checks SHALL report React Doctor error-level findings for the affected simulation route set where feasible
- **AND** the project SHALL NOT add GitHub Actions integration for this check unless CI quota constraints are explicitly changed.

### Requirement: Final simulation visual QA waits for handoff alignment
The final simulation visual QA gate SHALL validate the handoff-aligned implementation, not the earlier partial visual baseline.

#### Scenario: Final simulation visual QA is evaluated
- **WHEN** `govern-simulation-experience-visual-qa` or its successor runs after this change is registered
- **THEN** it SHALL include this handoff-alignment change as a prerequisite or documented dependency
- **AND** it SHALL reject evidence that only proves route inventory, token usage, or nonblank scenes without handoff alignment.

### Requirement: Commercial UI governance verifies AppShell navigation preference persistence
Commercial UI governance SHALL verify that collapsed desktop navigation is the default and that user preference persists across representative platform routes.

#### Scenario: Navigation preference evidence is captured
- **WHEN** visual or interaction evidence is produced for AppShell route-frame changes
- **THEN** the evidence SHALL include default collapsed desktop navigation, user-expanded desktop navigation, route-to-route preference persistence across representative student, teacher, and administrator routes, and mobile drawer behavior
- **AND** the evidence SHALL prove that collapsed navigation does not overlap local workspace tools or the shared floating dock.

#### Scenario: Preference regression is detected
- **WHEN** a route resets the desktop navigation state without user action, renders expanded by default without an approved exception, or leaks desktop rail geometry into mobile
- **THEN** governance SHALL fail or report the route as a blocking shell regression according to the active governance mode.

### Requirement: Knowledge graph interaction QA blocks jitter regressions
Commercial UI governance SHALL verify that knowledge graph hover, selection, inspector, and drag interactions do not create visible layout jitter.

#### Scenario: Knowledge graph interaction evidence is captured
- **WHEN** governance validates `/knowledge` interaction states
- **THEN** evidence SHALL include hover preview, node selection, inspector open/close, user drag, and explicit relayout states
- **AND** the evidence SHALL prove that hover and selection do not trigger unintended graph redistribution.

#### Scenario: Jitter regression is detected
- **WHEN** pointer hover, node click, or inspector updates visibly reset layout, move unrelated nodes, or remount the graph surface
- **THEN** governance SHALL fail or report a blocking interaction-stability regression.

### Requirement: Knowledge graph semantic-map evidence is required
Commercial UI governance SHALL require current evidence that the knowledge graph presents a readable semantic map, not only that relation mappings exist.

#### Scenario: Semantic-map presentation is checked
- **WHEN** governance validates `/knowledge`
- **THEN** checks SHALL include default semantic map, selected-neighborhood clarity, dense/all-relations mode, graphical legend consistency, light theme, and dark theme
- **AND** screenshots alone SHALL NOT pass unless current source or DOM evidence also proves graph and legend styles share the same visual contract.

#### Scenario: Presentation regression is detected
- **WHEN** relation edges are globally thick or saturated, relation types rely on color alone, semantic clusters are absent or decorative, labels are unreadable, or the graph returns to an all-edge tangle by default
- **THEN** governance SHALL fail or report a blocking semantic-map presentation regression.

### Requirement: Knowledge workspace product QA verifies the integrated experience
Commercial UI governance SHALL verify the redesigned knowledge graph as an integrated product workspace across shell, tools, graph interaction, inspector, assistant, theme, and mobile states.

#### Scenario: Knowledge workspace QA matrix is captured
- **WHEN** `/knowledge` is reviewed after redesign
- **THEN** evidence SHALL include AppShell collapsed default, AppShell expanded persisted state, semantic-map presentation, compact local tools, opened directory/filter/legend controls, selected-node inspector, hover preview, node click, dragged-node persistence, explicit relayout, Konling collapsed/expanded/selected/no-selection/degraded states, light theme, dark theme, focus management, and 320px mobile behavior
- **AND** the evidence SHALL identify route, theme, viewport, navigation state, dock state, local tool state, selected node, interaction state, and result.

#### Scenario: Knowledge workspace stress state is captured
- **WHEN** `/knowledge` is reviewed after redesign
- **THEN** evidence SHALL include a combined stress state with expanded AppShell navigation, at least one opened local graph tool, selected-node inspector, and expanded Konling assistant
- **AND** graph interaction, inspector actions, local tool controls, and Konling controls SHALL remain visible, keyboard reachable, focus-managed, and non-overlapping.

#### Scenario: Knowledge workspace empty assistant state is captured
- **WHEN** `/knowledge` renders with no selected node or incomplete selected-node context
- **THEN** Konling evidence SHALL show route-level or degraded guidance
- **AND** it SHALL NOT claim selected-node diagnosis, evidence analysis, or resource access that has not been resolved.

#### Scenario: Product Design concepts are referenced
- **WHEN** knowledge workspace visual evidence is produced
- **THEN** the evidence SHALL cite `artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md` as the design source of truth
- **AND** the evidence SHALL cite the approved concept references and state which visual principles were adopted
- **AND** it SHALL state which generated mockup details were rejected to preserve the shared AppShell, role navigation, and dock model.

#### Scenario: Handoff alignment is evaluated
- **WHEN** `/knowledge` is reviewed after the redesign implementation
- **THEN** QA evidence SHALL include a handoff-to-implementation matrix covering adopted, rejected, and merged guidance from `design-handoff.md` and `concepts/README.md`
- **AND** concept image evidence SHALL be evaluated only through that handoff guidance
- **AND** route inventory, platform tokens, screenshots, DOM markers, or source checks SHALL NOT be sufficient when the visible result contradicts the handoff.

### Requirement: Knowledge workspace QA requires independent visual subagent review
Commercial UI governance SHALL require an independent visual review subagent before the knowledge graph workspace product QA can pass.

#### Scenario: Visual review subagent runs
- **WHEN** implementation screenshots and current-source evidence are ready for `/knowledge`
- **THEN** an independent visual review subagent SHALL receive `design-handoff.md`, `concepts/README.md`, the three concept image paths, implementation screenshots, changed files, and evidence artifacts
- **AND** the subagent SHALL report PASS/BLOCK findings for handoff alignment, accepted concept adoption, rejected generated details, AppShell continuity, local graph tool integration, semantic-map readability, inspector hierarchy, Konling dock behavior, hover/click/drag stability, keyboard and focus behavior, theme parity, mobile behavior, and combined stress-state non-overlap
- **AND** unresolved BLOCK findings SHALL prevent `govern-knowledge-workspace-product-qa` from being marked complete.

#### Scenario: Integration regression is detected
- **WHEN** `/knowledge` shows duplicated global navigation, duplicated assistant UI, permanent desktop panels that compete with the graph, text-only relation legend, raw schema labels, semantic-map tangle, hover/click jitter, dragged-node reset, dock overlap, crowded stress-state obstruction, or theme/mobile inconsistency
- **THEN** governance SHALL fail or report the issue as a blocking product QA regression according to the active governance mode.

### Requirement: Knowledge workspace QA checks current behavior
Commercial UI governance SHALL validate current source, DOM, runtime graph data, and browser behavior rather than relying only on historical screenshots.

#### Scenario: Knowledge graph evidence exists from an earlier run
- **WHEN** governance validates the current `/knowledge` route
- **THEN** historical screenshots MAY be used as supporting context
- **AND** current source/runtime checks and fresh browser evidence SHALL remain the acceptance truth.

#### Scenario: Browser validation runs locally
- **WHEN** local browser evidence is captured for `/knowledge`
- **THEN** the capture SHALL use a hydrated local URL that reflects the active Next dev server
- **AND** false positives from non-hydrated `127.0.0.1` proxy paths SHALL be avoided or explicitly marked invalid.

### Requirement: Interactive learning product QA verifies handoff alignment
Commercial UI governance SHALL verify the interactive learning redesign against the accepted Product Design handoff and concept images.

#### Scenario: Interactive learning product QA matrix is captured
- **WHEN** the interactive learning redesign is reviewed
- **THEN** evidence SHALL include atlas, course catalog, chapter components, cross-domain list, course entry, teacher waiting, student runtime, guest runtime, teacher projection runtime, invalid session, representative module states, Konling dock, light theme, dark theme, desktop, mobile, and focus management
- **AND** every evidence item SHALL identify route, role, theme, viewport, navigation state, dock state, page state, module state, source concept, and result.

#### Scenario: Per-change design QA is aggregated
- **WHEN** final interactive learning product QA runs
- **THEN** the design-qa report for each child change SHALL be present
- **AND** every child design-qa report SHALL say `final result: passed`
- **AND** missing, blocked, or stale design-qa evidence SHALL fail final QA.

#### Scenario: Handoff alignment is evaluated
- **WHEN** final visual evidence is produced
- **THEN** the evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** it SHALL cite the accepted concept images used by each route family
- **AND** route inventory, token usage, or nonblank screenshots SHALL NOT be sufficient when the visible result contradicts the handoff.

### Requirement: Interactive learning final QA requires independent visual review
Final interactive learning product QA SHALL require an independent visual review subagent before acceptance.

#### Scenario: Visual review subagent runs
- **WHEN** implementation screenshots and evidence artifacts are ready
- **THEN** an independent visual review subagent SHALL receive the design handoff, accepted concept image paths, implementation screenshots, changed files, and evidence artifacts
- **AND** the subagent SHALL report PASS/BLOCK findings for atlas, course entry, waiting, runtime modes, module chrome, AppShell continuity, Konling dock, theme parity, mobile behavior, accessibility, and concept alignment
- **AND** unresolved BLOCK findings SHALL prevent completion.

#### Scenario: Interactive learning regression is detected
- **WHEN** pages show duplicated global navigation, missing breadcrumbs, fixed full-page centered width, missing Konling dock, Konling embedded into a course right rail, permanent teacher right drawer, top duplicate next-page action, missing teacher page-jump dropdown, oversized teacher bottom navigation, student answer inputs in teacher mode, teacher stats in student/guest mode, or unregistered module chrome
- **THEN** governance SHALL fail or report the issue as a blocking product QA regression.

### Requirement: Adaptive execution and history UI requires design-qa evidence
Commercial UI governance SHALL require visual evidence for adaptive path execution and history surfaces against the accepted handoff and concept images.

#### Scenario: Adaptive execution UI is reviewed
- **WHEN** current path execution, node detail, skip, or history UI changes
- **THEN** evidence SHALL include desktop and 320px mobile screenshots in light and dark themes
- **AND** it SHALL include active full-path map, current-node state, completed-node actions, skip warning, history timeline, and shared dock non-overlap.

#### Scenario: Visual subagent review runs
- **WHEN** implementation evidence is ready
- **THEN** a browser-capable visual subagent SHALL compare screenshots to the handoff, `03-active-path-execution.png`, and `04-history-evidence-record.png`
- **AND** unresolved BLOCK findings SHALL fail acceptance.

### Requirement: Simulation resource palettes are governed
Commercial UI governance SHALL detect migrated simulation resource components that introduce unapproved page-local or resource-local palettes.

#### Scenario: Simulation resource styling is checked
- **WHEN** governance scans changed simulation resource files after this migration
- **THEN** new unapproved hard-coded `bg-white`, `bg-slate-*`, `text-white`, `text-slate-*`, raw hex colors, or resource-local gradient systems SHALL fail or be reported according to the active governance mode
- **AND** approved simulation theme primitives, status tokens, and documented temporary exceptions SHALL be allowed.

### Requirement: Simulation scene theme parity is governed
Commercial UI governance SHALL reject simulation visual evidence that proves only AppShell theme changes without proving simulation-internal scene and panel theme parity.

#### Scenario: Simulation theme evidence is evaluated
- **WHEN** visual evidence is submitted for a migrated simulation detail route
- **THEN** governance SHALL require the evidence to show theme-aware resource panels, local controls, scene visual parameters, HUD labels, and shared dock behavior
- **AND** screenshots where the dark route still embeds an unchanged light scene or white resource panel SHALL fail acceptance unless explicitly documented as a temporary exception with an owner and removal condition.

### Requirement: Adaptive generation UI requires design-qa evidence
Commercial UI governance SHALL require visual evidence for the adaptive path generation and selection UI against the accepted handoff and concept images.

#### Scenario: Adaptive generation UI is reviewed
- **WHEN** `/assessment/adaptive-practice` generation or selection UI changes
- **THEN** evidence SHALL include desktop and 320px mobile screenshots in light and dark themes
- **AND** it SHALL include generation main state, Konling parameter state, path comparison state, cold-start state, and shared dock non-overlap.

#### Scenario: Visual subagent review runs
- **WHEN** implementation evidence is ready
- **THEN** a browser-capable visual subagent SHALL compare screenshots to the handoff and concept images
- **AND** unresolved BLOCK findings SHALL fail acceptance.
