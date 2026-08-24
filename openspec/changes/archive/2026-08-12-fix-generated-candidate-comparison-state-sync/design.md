## Context

The generation request already returns an authorized persisted candidate batch. The client stores that batch in component state, then uses `history.replaceState` to add its identifier to the current URL. The comparison visibility and auto-open calculations are derived from the framework search-parameter snapshot, which is not updated by the native history mutation during the same render lifecycle. A reload reconstructs the snapshot and makes the comparison visible, proving that persistence and authorization are working while client route synchronization is not.

## Goals / Non-Goals

**Goals:**

- Make the generated candidate batch visible immediately on the current generation page.
- Keep the current active path and generation controls available in the same integrated surface.
- Keep URL state, loaded candidate state, comparison visibility, and module expansion consistent.
- Preserve refresh recovery and learner-scoped authorization.

**Non-Goals:**

- Change candidate generation, ranking, persistence, or authorization.
- Replace the existing comparison module or redesign its cards.
- Automatically select or execute a candidate.
- Display another learner's candidate batch.

## Decisions

### Use framework navigation for successful generation state

After the authorized batch loads, update the URL through the App Router rather than directly mutating browser history. Framework navigation keeps `useSearchParams` and all values derived from it synchronized without a document reload.

Alternative considered: introduce a second local `generatedBatchId` source of truth and merge it with the route parameter. This would make the immediate view work but create two authorities for deep links, recovery, and later navigation.

### Retain the generation intent

The successful URL remains in `contextual-recommendation` intent with the generated `batch`. The existing UI contract allows comparison inside the generation workspace so the active path, configuration, and comparison remain on one page.

Alternative considered: redirect to `path-selection`. That would work technically but would split the workflow the Issue explicitly requires to remain integrated.

### Render only after an authorized batch load

Navigation occurs only after the candidate-batch endpoint returns the current learner's valid batch. Missing, failed, or unauthorized results continue to use existing recovery states and never expose placeholder formal candidates.

### Test the transition, not only the reload state

Regression coverage must exercise the successful generation action and assert that the comparison appears before any reload. Existing direct-link tests remain responsible for refresh and recovery behavior.

## Risks / Trade-offs

- [Framework navigation may trigger server-component refresh work] → Use `replace` rather than a full document assignment and preserve the current query parameters.
- [Navigation may reset transient component state] → The persisted batch remains authoritative, and the generation controls are already reconstructible from URL parameters.
- [Tests that only seed a batch can miss the original regression] → Add an action-driven browser case that explicitly forbids reload between generation success and comparison assertion.
