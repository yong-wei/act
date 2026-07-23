## Context

Control Odyssey is both an ordinary progression game and an Arena workspace. The current route passes only an Arena task id, the client begins at `level-1` and exposes its level selector, and the server applies ordinary credits and tier progress before producing an eligible Arena submission. The assigned task-to-level relation exists only as a level-to-task bridge mapping, which makes an assigned session neither constrained nor isolated.

## Goals / Non-Goals

**Goals:**
- Establish one shared, bidirectional task-to-level assignment source for routing, client entry, and server submission validation.
- Make an Arena launch a direct, assigned-level session that cannot navigate to free level selection or a next level.
- Allow an assigned session to use a normally locked level without mutating ordinary Odyssey progression.
- Preserve existing official telemetry, publication access, idempotent run handling, and Arena persistence behavior.

**Non-Goals:**
- Redesign Odyssey levels, controller unlocks, game scoring, or ordinary free-play navigation.
- Convert existing historic ordinary runs into Arena submissions.
- Add a persistent entitlement or schema migration for temporary level access.
- Add more Arena tasks or change their evaluation metrics.

## Decisions

### Use a pure assignment module shared by client and server

Create a small Arena Odyssey assignment module containing the explicit task-to-level and level-to-task mapping plus lookup helpers. `workspace-routing`, the Control Odyssey client, and the server action consume this module; `bridge.ts` retains only submission construction and delegates mapping lookups to it.

Alternative considered: pass `odysseyLevelId` only as a query parameter and trust it at completion. Rejected because a query parameter can be altered and would duplicate the server's task mapping.

Alternative considered: let the client import `bridge.ts`. Rejected because the bridge imports persistence code and would couple a client component to server-only behavior.

### Model the Arena session as a client flow restriction, not a normal unlock

`ControlOdysseyGame` derives an Arena-assigned level from `arenaTask`. When present and valid, it initializes directly in configuration for that level; it omits intro, level selector, return-to-menu, and next-level actions. The selected level remains usable even when the ordinary profile marks it locked.

Alternative considered: set `unlocked: true` in the shared level list. Rejected because that state can leak into ordinary navigation and incorrectly represents a temporary exception as an unlock.

### Derive progression isolation from the persisted assignment contract

The server considers a run an Arena-assigned run only when the persisted replay snapshot's level maps to the persisted `arenaTaskId`. Such a run still creates the simulation log and runs the official Arena bridge, but skips ordinary credit, tier-progress, and controller-unlock mutations. Mismatched or missing mappings retain ordinary gameplay behavior and cannot produce an Arena submission.

Alternative considered: identify Arena sessions only from the incoming retry request. Rejected because retries must use the persisted replay snapshot and must not trust altered browser payloads.

## Risks / Trade-offs

- [A future task is configured without an assignment] -> Routing and client entry retain existing safe behavior, while the server cannot create an Arena bridge submission until the mapping is explicitly added.
- [Arena users expect ordinary rewards] -> The Arena shell and task context remain visible; the specification defines that evaluation writeback, rather than Odyssey progression, is the reward path.
- [Existing level-1 Arena runs were credited under old behavior] -> No historical mutation occurs; only newly completed, valid assigned runs use the isolation rule.

## Migration Plan

1. Deploy the shared assignment mapping with the client routing and server isolation changes.
2. Existing completed runs remain replayable under their persisted snapshot; no data migration is required.
3. Roll back by reverting the change; no schema or durable entitlement must be unwound.
