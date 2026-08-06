# Issue 1140 Phase C Browser Evidence

This directory records commit-bound browser evidence for Konling candidate-path selection.

- Route: `/assessment/adaptive-practice?goal=control-correction&intent=path-selection&batch=path-candidate-batch_issue1140_c&candidate=path-candidate_sprint_c`
- Viewports: 1440 x 1000 and 320 x 900
- Source checkpoint: `365a142`
- Evidence checkpoint: `a4b6ada`
- Manifest: `konling-selection-manifest.json`

The run verifies ambiguity clarification, explicit governed-candidate selection, a visible failed sync, an explicit same-identity retry after remount, successful synchronization, candidate deep-link focus, keyboard access to the send action, no automatic path start, and no horizontal overflow.

The fail-closed fixture represents an authenticated demo learner and scopes path-advisor context, learner state, candidate batch, candidate identity, and choice mutation to the same owner, goal, path, batch, and candidate. The first choice request is deliberately aborted; the retry uses the same server idempotency identity.
