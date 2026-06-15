## Design Source

Authoritative source: `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`.

Accepted concept images:

- `concepts/01-learning-atlas-course-catalog.png`
- `concepts/02-course-entry-shell.png`
- `concepts/revised/01-course-catalog-theory-practice.png`
- `concepts/revised/02-teacher-classroom-qr-waiting.png`
- `concepts/revised/03-student-guest-runtime.png`
- `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`

## Design Decisions

- Product QA is not a screenshot archive; it is a blocking comparison against handoff and concepts.
- Every child change must produce its own design-qa result before the final QA can pass.
- Final QA must include an independent visual review subagent.
- Historical screenshots and route inventory are supporting context only; current implementation screenshots and source checks are acceptance truth.

## Visual QA Gate

This change can pass only after all upstream design-qa reports are present and passed. The final QA must compare current implementation screenshots to the handoff and accepted concept images, include a handoff-to-implementation matrix, document adopted/rejected generated-image details, and resolve every P0/P1/P2 finding.

## Dependency And Issue Registration

- Blocked by `unify-interactive-learning-atlas-shell`.
- Blocked by `migrate-interactive-course-entry-shell`.
- Blocked by `standardize-interactive-classroom-entry`.
- Blocked by `standardize-lesson-runtime-shell`.
- Blocked by `define-interactive-module-visual-standards`.
- Also blocked by `persist-app-shell-navigation-preference` if that external change remains active.
- Must be registered under series `interactive-learning-ui-redesign`.
- Its issue must not be marked ready for implementation until all child design-qa reports exist and are passed.
