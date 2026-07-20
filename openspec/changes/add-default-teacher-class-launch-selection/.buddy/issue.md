<!-- openspec-buddy change_id: add-default-teacher-class-launch-selection -->

## Goal

Give every teacher with an active class one global default class and require all new teacher classrooms to bind an explicitly reviewed active class through one shared launch dialog.

## Scope

- Add the teacher-owned default preference, deterministic lifecycle replacement, migration, and accessible class-card management.
- Unify interactive-course, lesson-plan, playlist, and class-detail launch selection while preserving administrator temporary classrooms and historical session identity.

## Acceptance

- Each teacher with active classes has exactly one valid default, and concurrent class mutations preserve that invariant.
- Every teacher launch dialog preselects current class context or the default, permits another active class for that session, and never changes the preference implicitly.
- Teacher session creation rejects missing, foreign, or inactive classes; administrator temporary sessions and historical classless sessions retain their established semantics.
- Desktop, keyboard, touch/mobile, API, migration, concurrency, classroom lifecycle, and full repository delivery gates pass.

Proposal: https://github.com/yong-wei/act/tree/integration/openspec/changes/add-default-teacher-class-launch-selection
