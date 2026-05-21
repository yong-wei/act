## Context

Leaderboard logic already supports `main`, `method`, `metric`, `pareto`, `class`, and `season`. The UI and persistence model do not yet express honors, showcase selection, or broad leaderboard navigation.

## Goals / Non-Goals

**Goals:**

- Make multiple leaderboard views discoverable and meaningful.
- Derive honors from official results such as first pass, low energy, fastest response, best improvement, and Pareto-front presence.
- Provide a privacy-conscious showcase surface for excellent solutions.

**Non-Goals:**

- Do not modify official scoring formulas.
- Do not publish full private controller payloads without explicit policy.
- Do not implement teacher lecture mode in this change.

## Decisions

- Use official submission/evaluation records as the source of honors.
- Keep badge criteria deterministic and testable.
- If persistence is needed, introduce narrow models rather than overloading submission metadata.

## Risks / Trade-offs

- Badge criteria can feel arbitrary. Keep criteria tied to metrics and hard constraints.
- Showcase can leak student work. Default to summary evidence and require explicit publication policy for details.

## Migration Plan

1. Extend leaderboard view models.
2. Add honor derivation helpers and optional persistence.
3. Add showcase data structures and UI.
4. Test Pareto, method, metric, class, and season behavior.
