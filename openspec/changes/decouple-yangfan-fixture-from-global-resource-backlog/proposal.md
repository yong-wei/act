## Why

The helper currently reports Yang Fan fixture readiness as blocked by the global resource evidence backlog. That makes the test account unusable for graph, path-planning, Konling, and adaptive-answering verification even when a smaller reviewed resource subset is sufficient for fixture tests.

The fixture should never fabricate citations or learner evidence, but it also should not wait for every textbook search document, figure, caption, and legacy resource to be completed before basic integration testing can run.

## What Changes

- Define a scoped fixture-readiness policy for Yang Fan and other canonical test accounts.
- Allow fixture generation to proceed when the fixture-owned resource subset has reviewed citation, path, and evidence-lineage contracts.
- Keep unrelated global resource blockers visible in helper output as residual platform limitations rather than fixture blockers.
- Require fixture diagnostics to mark limited coverage when the global backlog is incomplete.

## Impact

- Unblocks practical test-account validation without weakening resource governance.
- Does not create Yang Fan fixture data directly.
- Does not mark unreviewed resources as citation-ready, path-ready, or evidence-ready.
