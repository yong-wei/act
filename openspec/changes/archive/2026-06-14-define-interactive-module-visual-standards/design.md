## Design Source

Authoritative source: `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`.

Runtime reference images:

- `concepts/revised/03-student-guest-runtime.png`
- `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`

## Design Decisions

- Module chrome is shared infrastructure, not per-course styling.
- Teacher controls attach to their corresponding interaction modules because a page may contain multiple interactions.
- Projection mode favors readability, stable geometry, and clear current action over dense analytics.
- Student mode favors current task, answer affordance, feedback, and honest state.
- Guest/demo mode must not display real evidence or teacher analytics.
- New module visual variants require registration and tests.

## Visual QA Gate

Implementation must produce representative module visual evidence and design-qa coverage for at least one content module, one choice module, one ordering or pairing module, one media/diagram module, one teacher-control state, and one resource-missing or invalid state.

The student/guest module evidence must compare against `concepts/revised/03-student-guest-runtime.png`. The teacher-control and projection module evidence must compare against `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`. Generic references to "accepted runtime concepts" are not sufficient for acceptance.

Blocking mismatches include per-course unregistered chrome, controls detached from the wrong interaction, unstable module geometry, unreadable projection typography, theme mismatch, or student/guest/teacher role leakage.

## Dependency And Issue Registration

- Blocked by external change: `persist-app-shell-navigation-preference`.
- Must be registered under series `interactive-learning-ui-redesign`.
- Blocks `standardize-lesson-runtime-shell`.
