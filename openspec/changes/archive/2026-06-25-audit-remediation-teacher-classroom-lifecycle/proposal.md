## Why

Teacher classroom audit findings still show fragmented class binding, unclear live-class identity, repeated active sessions, weak delivery confirmation, and poor end-of-class transition. These are not path/resource/KAQ concerns; they are classroom lifecycle issues that should be remediated as a separate vertical flow.

## What Changes

- Make class-bound and temporary classroom creation explicit before launch.
- Prevent accidental duplicate active sessions for the same teacher, lesson, class, and launch context unless the teacher intentionally creates a new session.
- Show class or temporary-class identity consistently in teacher projection, QR/code surfaces, student runtime, and session summary.
- Add online-student roster, current step, heartbeat or freshness, released-task delivery state, and not-yet-submitted lists where the audit requires them.
- Route ended classrooms to an end/review state instead of preserving a live projection surface.
- Exclude report export/send, prep-pack generation, KAQ diagnosis, and path-planning changes from this lifecycle scope.

## Capabilities

### New Capabilities
- `audit-remediation-teacher-classroom-lifecycle`: audit remediation contract for class binding, live classroom identity, delivery state, student presence, session ending, and lifecycle recovery.

### Related Capabilities
- `session-quality-status`: require lifecycle state to distinguish draft, live, ending, ended, and review handoff states.
- `session-finalization-quality`: require classroom finalization to produce student and teacher landing states that do not look live.
- `interactive-governance-evidence`: require release, delivery, submission, and finalization evidence to be inspectable without raw session-id leakage.

## Impact

- Affects teacher lesson launch, class detail launch actions, teacher projection/runtime headers, QR/classroom-code modals, student runtime classroom identity, session state APIs, and classroom end flow.
- Evidence sources include findings 81-96, 129-130, 146, 287, and related classroom lifecycle entries from the full-system Product Design audit.
- Acceptance requires browser or Playwright evidence for teacher and student roles, including class-bound and temporary classroom paths.
