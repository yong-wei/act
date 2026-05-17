## Context

`getArenaWorkspaceHref` currently routes each workspace mode to a different page. This was useful during early development, but after unified presets exist it becomes the source of fragmented student experience. The migration should not happen before presets are implemented because challenge detail pages already removed direct submission forms.

## Goals / Non-Goals

**Goals:**
- Make the unified workbench the default Arena entry for implemented presets.
- Preserve route parameters used by assignment and publication workflows.
- Keep Odyssey separate until its bridge is ready.

**Non-Goals:**
- No implementation of missing presets.
- No change to leaderboard visibility or official evaluation semantics.
- No removal of legacy routes.

## Decisions

- Use `preset=<workspaceMode>` for first migration.
  Rationale: it is simple, traceable, and preserves existing task policy vocabulary.

- Keep Odyssey route separate at first.
  Rationale: Odyssey has game state, level progression, original score, and shop/credit mechanics that should not be embedded during generic routing migration.

- Do not delete old workbench routes.
  Rationale: course pages and external links may still depend on them.

## Risks / Trade-offs

- [Risk] A task may route to a preset that was not implemented.
  → Mitigation: add tests that only implemented workspace modes are migrated and all others keep their legacy route.

- [Risk] Publication context could be lost during URL rewriting.
  → Mitigation: add tests for `publicationId` preservation.
