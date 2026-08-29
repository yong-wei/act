# Characterization fixtures — cutover-personalization-path-planner

Frozen at HEAD `8c3ddda916edd4b1e37a7b67d7d48b29f3a26ef6`.

Existing suites already encode the required behaviors. This change treats them as characterization, not a second schema:

| Behavior | Existing evidence |
| --- | --- |
| Candidate ordering | `src/lib/__tests__/adaptive-learning-path-planner.test.ts` plan node order / policy fixtures |
| Hard eligibility | same suite; capability/readiness locked nodes must not appear as qualified |
| Constraint repair | `src/lib/__tests__/path-constraint-repair.test.ts` |
| Terminal validation | planner tests for terminal/capability coverage |
| Explanations | planner tests for explanation payload; must not contain raw answers |
| Stale revision | learning-path adoption/plan route tests and planner persistence revision checks |
| Append-only path history | `control-correction-path-rounds` persist tests; history append not overwrite |

Representative live freeze: `src/features/personalization/path-planning/__tests__/characterization.test.ts` (added by this change) calls the current authority and snapshots node ids, eligibility vs ranking, and explanation privacy.
