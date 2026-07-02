## Context

The audit found that the class session backend can hold useful classroom facts, but the user-facing lifecycle is unclear. Teachers cannot reliably distinguish class-bound from temporary launch, students see raw session ids, delivery state is under-specified, and ended classrooms can still look live.

## Design

1. Launch identity.
   - Teacher launch surfaces require an explicit class-bound or temporary-class choice.
   - Duplicate active sessions for the same teacher, lesson, class, and launch context require an explicit confirmation or reuse action.

2. Live classroom identity.
   - Teacher projection, QR/code dialogs, student runtime, and session summary use a common classroom identity payload.
   - Student-facing copy must use class/lesson/session display names, not raw ids as primary labels.

3. Delivery and presence.
   - Teacher runtime shows online roster, current step, freshness/heartbeat, release delivery, not-started, in-progress, and submitted counts.
   - Student runtime shows released state and ended state without exposing teacher-only summary details.
   - Release, page-change, copy-code, start-class, online-panel, submit, and end-class events carry stable event type, actor role, client event id, source log id when available, client timestamp, and dedupe identity.
   - Classroom controls have stable accessible names and status/live announcements.

4. End and review transition.
   - Ending a classroom routes teacher and students to ended/review states.
   - Ended sessions must not expose live projection controls as the primary surface.

## Out Of Scope

- Report export/send/copy, prep-pack generation, KAQ diagnosis, path planning, and resource readiness.

## Evidence

- Browser evidence must cover teacher and student roles for at least one class-bound session and one temporary classroom path.
- Audit finding updates must distinguish lifecycle closure from report-delivery closure.
