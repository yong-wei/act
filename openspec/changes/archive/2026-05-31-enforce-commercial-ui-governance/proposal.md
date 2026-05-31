## Why

Commercial UI quality will regress unless the repository has enforceable governance. The platform already has semantic shell specs, but there is no strict gate that prevents new page-local palettes, unregistered shells, unsupported module skins, or decorative card-heavy layouts from reappearing after the redesign.

## What Changes

- Define UI governance gates for commercial brand tokens, shell registration, student navigation coverage, workspace surface rules, module chrome, and visual anti-patterns.
- Add automated checks where deterministic checks are possible, and documented review gates where visual judgment is required.
- Require new student-facing and workspace UI to use registered brand, shell, navigation, status, and module primitives.
- Require a route-based visual acceptance matrix, accessibility checks, and text-fit checks for commercial UI changes.
- Stage strict enforcement after the student entry and workspace migrations so old debt does not block unrelated work prematurely.

## Capabilities

### New Capabilities
- `commercial-ui-governance-gates`: Defines automated and review-based gates for commercial UI consistency.

### Modified Capabilities
- `platform-design-system-and-shell`: Adds enforceable governance for token use, shell registration, and legacy-shell retirement.
- `platform-role-navigation`: Adds navigation coverage checks for student core destinations and intent groups.
- `interactive-course-standard-module-migration`: Adds registry gate expectations for commercial module chrome.

## Impact

- Affects lint/test scripts, design-token source checks, shell/route inventories, module registry validation, and PR review checklists.
- Depends on `define-commercial-brand-language`, and should be enforced strictly after `redesign-commercial-student-entry-surfaces` and `upgrade-commercial-workspace-surfaces` finish their migrations.
- Does not migrate UI by itself; it prevents drift after the migration series.
