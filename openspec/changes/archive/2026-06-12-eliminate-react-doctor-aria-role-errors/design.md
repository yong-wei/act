## Context

The React Doctor `aria-role` findings include 15 unique source locations. Eight are concentrated in interactive course student/teacher pages:

- Unit 4-1 student and teacher pages
- Unit 5-1 student and teacher pages
- Unit 5-2 student and teacher pages
- Unit 5-3 student and teacher pages

The remaining seven are platform shell call sites for learner, Arena, control workbench, knowledge, and data-center surfaces that passed business identity into `AppShell role`. The reported values are business roles, not accessibility roles. In several files the value is passed to custom components as a prop named `role`; that is still a problem because it collides with React/ARIA naming and may be forwarded to DOM. ARIA `role` must describe UI semantics such as `region`, `navigation`, `main`, `button`, or `status`; it must not be used as a domain marker.

## Goals / Non-Goals

**Goals:**

- Remove every invalid ARIA role reported by React Doctor.
- Preserve any business-role information needed by tests, analytics, or styling through non-ARIA attributes.
- Add a lightweight guard so newly authored interactive pages and platform shell entry points do not reintroduce `role="student"` or `role="teacher"`.

**Non-Goals:**

- Do not redesign interactive course layouts.
- Do not change route-level authentication or teacher/student authorization.
- Do not perform a full accessibility redesign beyond the invalid-role error class.

## Decisions

1. **Business identity must not use ARIA role.**

   Replace business props named `role` with `viewerRole`, `surfaceRole`, or another explicit domain name. Use `data-role="student"` or `data-role="teacher"` only when a stable DOM marker is needed. If tests use role selectors, migrate them to data attributes or accessible names.

2. **Use semantic HTML first.**

   If the marked element is a main content container, prefer `<main>` or `role="main"` only when necessary. For bounded course panels, prefer `<section aria-label="...">` or `role="region"` with an accessible name.

3. **Guard the exact regression.**

   A narrow static test or script is enough for this change: it should fail on JSX `role="student"` or `role="teacher"` in source files and should verify that renamed business props are not forwarded to DOM role attributes. This implementation scans App Router pages, feature TSX files, and platform shell components so both the original interactive-course findings and the platform shell findings remain covered. A broader a11y audit can be proposed separately if needed.

## Risks / Trade-offs

- **Existing tests may query by invalid role.** → Update tests to use visible text, accessible names, or `data-role`.
- **Changing role to `region` without labels can create new a11y noise.** → Use semantic elements or add accessible names when a landmark role is required.
- **A narrow guard will not catch every invalid ARIA value.** → This change targets known error-level regressions; broad accessibility linting can be a later governance change.
