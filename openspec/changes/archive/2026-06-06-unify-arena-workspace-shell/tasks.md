## 1. Shell Prototype

- [x] 1.1 Define the Arena-first workspace shell API, including navigation entries, active route, breadcrumbs, personal-center action, optional actions, and content width behavior.
- [x] 1.2 Implement desktop expanded and collapsed navigation states with accessible names, active route indication, keyboard focus, and persisted or route-stable state where appropriate.
- [x] 1.3 Implement mobile drawer navigation so 320px viewports keep Arena task content reachable.
- [x] 1.4 Integrate the shell with Arena hall and challenge detail without changing Arena domain data, scoring, publication, or workbench routing logic.

## 2. Arena Visual Assets

- [x] 2.1 Create a centralized Arena visual-world asset directory under the platform public assets tree.
- [x] 2.2 Generate or author Arena visual assets for control-bench identity, challenge map identity, score/leaderboard context, and empty/fallback state without embedded readable text.
- [x] 2.3 Add an asset usage manifest or equivalent central mapping so Arena pages do not hard-code scattered asset paths.
- [x] 2.4 Verify every asset has acceptable fallback behavior and remains usable in light and dark themes.

## 3. Arena UI Migration

- [x] 3.1 Remove visible `商业` wording from Arena student-facing text while preserving premium platform intent.
- [x] 3.2 Replace emoji-like or decorative symbolic treatments with the platform icon system, shared status semantics, or centralized Arena visual assets.
- [x] 3.3 Rework Arena hall first viewport so challenge continuation, discovery, filters, and first challenge cards remain task-first on desktop and wide desktop.
- [x] 3.4 Rework Arena challenge detail first viewport so challenge identity, evaluation context, and primary workbench entry remain visible ahead of secondary content.

## 4. Governance and Validation

- [x] 4.1 Update route inventory or UI governance metadata for Arena shell state, asset ownership, and visual QA expectations.
- [x] 4.2 Add or update focused tests for shell rendering, breadcrumb continuity, personal-center naming, no visible `商业` text, and no emoji-based workspace symbols.
- [x] 4.3 Run OpenSpec validation for this change and affected specs.
- [x] 4.4 Run focused UI/tests for Arena routes plus lint or type checks required by touched files.
- [x] 4.5 Capture visual evidence for `/arena` and one representative challenge detail route at desktop, wide desktop, and 320px mobile in light and dark themes, including expanded/collapsed/drawer navigation states.
