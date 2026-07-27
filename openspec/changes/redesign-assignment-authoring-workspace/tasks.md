## 1. Workspace structure

- [x] 1.1 Build the left question outline with `从题库选择`, `新建题目`, ordered question rows, and accessible selection/reordering.
- [x] 1.2 Place assignment title and instructions once before the selected-question editor in the main region.
- [x] 1.3 Integrate the shared embedded editor for prompt and reference-answer fields after its dependency is available.
- [x] 1.4 Consume the unified response projection in teacher authoring and preview, removing active `TEXT`/`FILE` branches while retaining audit-only history.

## 2. Scoring and localization

- [x] 2.1 Build stable-id scoring-item accordions with the required collapsed summary and expanded scoring fields.
- [x] 2.2 Preserve complete scoring-item records and focus while moving or deleting items.
- [x] 2.3 Add centralized Chinese labels for question-bank source, question type, review state, version, and grading readiness, with tests that reject unmapped values.
- [x] 2.4 Derive and display assignment total from question points with no separate total input.

## 3. Save and publication states

- [x] 3.1 Display the four save states and consume publication-baseline readiness from the publication contract.
- [x] 3.2 Keep draft field feedback in place without moving page position or focus during autosave.
- [x] 3.3 Build the default-collapsed publication settings section and its class-name, publication-time, and due-time summary.
- [x] 3.4 Build the publication problem list, automatic section expansion, and focus/scroll targeting for invalid fields.
- [x] 3.5 Ensure example text is implemented as placeholders and never persisted as content.

## 4. Verification

- [x] 4.1 Add component tests for outline ordering, accordion summaries, derived total, Chinese labels, save states, and publication summary.
- [x] 4.2 Add keyboard and screen-reader tests for question navigation, error targeting, accordions, reordering, and focus restoration.
- [x] 4.3 Run affected unit tests, typecheck, and browser acceptance at supported teacher editing widths.
