## Design

The planner accepts optional SAR candidate refs and trace metadata. It maps candidate refs to ResourceNode/PlanningUnit records and applies the existing path eligibility and readiness gates. Candidates that cannot be mapped to audited PlanningUnits can remain supporting evidence but cannot become PathNodes.

## Candidate Tiers

1. Graph-mandated resources.
2. Teacher-assigned resources.
3. ResourceNode eligible resources.
4. SAR-associated supplemental candidates.

Tier 4 can increase diversity and explanation quality but cannot override earlier gates.

## Explanation

Path output should include an associative retrieval basis with trace id, seed entities, candidate resource node ids, selected SAR candidates, rejected SAR candidates, and rejection reasons.

## Disabled Behavior

Planner output must remain stable when SAR is disabled or unavailable.
