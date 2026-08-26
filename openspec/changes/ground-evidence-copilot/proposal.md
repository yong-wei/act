## Why

The Evidence Copilot entry at `/ai/copilot?context=evidence` constructs an evidence summary from URL parameters such as `source`, while `/api/ai/chat` does not consume a server-authorized evidence context. The page therefore looks like an evidence review workflow without proving that the described source belongs to the signed-in student or that the assistant answer is grounded in the student's governed learning records.

This is a learning-process accompaniment defect. A student can receive advice that appears personalized even when the source is fabricated, unavailable, or unrelated to the current learner. That weakens evidence-based diagnosis and next-step practice guidance.

## What Changes

- Resolve Evidence Copilot context on the server from the authenticated student and governed learning evidence.
- Treat URL `source`, `assignment`, and `intent` values only as navigation and learning-goal hints.
- Preserve evidence availability, source coverage, freshness, confidence, and limitations in the student-safe projection.
- Keep missing, partial, stale, and unavailable evidence distinct from known zero values.
- Keep Evidence Copilot advisory: no automatic writes to official scores, leaderboards, `LearningFact`, or the learner profile.
- Keep ordinary Copilot requests without Evidence context behaviorally compatible.

## Scope

The change covers the Evidence Copilot page, the `/api/ai/chat` request boundary, the governed learner-state/evidence projection used by the route, and focused unit/route/browser acceptance. It does not redesign the general Copilot, create a second evidence store, or authorize client-provided raw evidence.

## Success Criteria

- A request with `context=evidence` produces a prompt context traceable to the authenticated student's authorized evidence only.
- Tampered or unsupported URL descriptors cannot expand the evidence scope.
- Empty, partial, stale, and unavailable evidence produce truthful student-facing limitations and a reachable evidence-gathering or practice action.
- Focused server, projection, and browser tests demonstrate the boundary and preserve ordinary chat behavior.
