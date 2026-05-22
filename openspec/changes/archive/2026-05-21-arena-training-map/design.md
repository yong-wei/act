## Context

The Arena Pro source plan identifies the first product gap as the absence of a visible training system. The current code has task, object, metric, leaderboard, and workspace metadata, but no first-class capability map.

## Goals / Non-Goals

**Goals:**

- Students can understand which control-design capabilities a challenge exercises.
- Arena hall can group challenges by training stage instead of only filtering them.
- Challenge detail pages explain prerequisites and likely failure points before entering the workbench.

**Non-Goals:**

- Do not change official scoring or leaderboard ordering.
- Do not add badges, honors, teacher reports, or personalized recommendation persistence in this change.
- Do not implement workbench flow changes here.

## Decisions

- Keep training metadata in the Arena challenge domain first, because current Arena challenge truth is seed-backed.
- Use stable capability identifiers plus display labels, rather than prose-only tags.
- Treat recommendation as deterministic task metadata in this change; personalized recommendation is a later change.

## Risks / Trade-offs

- Static metadata can drift from future challenge edits. Mitigate with fixture tests that ensure every challenge has required training fields.
- Hall redesign touches a visible route; keep behavior compatible with existing filters.

## Migration Plan

1. Extend Arena challenge types and seed metadata.
2. Add derived selectors for stage grouping and capability filtering.
3. Update hall and detail surfaces.
4. Add tests that fail on missing capability metadata.
