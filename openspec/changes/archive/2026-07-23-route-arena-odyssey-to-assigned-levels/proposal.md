## Why

Arena currently routes a Control Odyssey task with only `arenaTask`, while the game still starts at its default level and permits free level selection. A student can therefore complete a different level, retain a game score, and receive no Arena submission for the assigned task.

## What Changes

- Bind every Arena Control Odyssey task to its configured Odyssey level in the launch route and in the completion contract.
- Start Arena-assigned sessions directly in that level and remove access to the introductory and level-selection views.
- Permit temporary Arena access to a mapped level that is locked in ordinary Odyssey progression.
- Keep temporary Arena sessions out of ordinary Odyssey credits, tier progress, and level-unlock advancement while preserving official Arena evaluation and submission writeback.
- Reject submission contexts whose requested Arena task does not match the persisted level-to-task mapping.

## Capabilities

### New Capabilities
- `arena-odyssey-assigned-level-access`: Defines controlled level entry and temporary-access semantics for Arena-launched Control Odyssey sessions.

### Modified Capabilities
- `arena-odyssey-submission-bridge`: Arena bridge submissions must use the persisted assigned level and remain isolated from ordinary Odyssey progression.
- `arena-workspace-routing-migration`: Arena Control Odyssey routes must carry the task's designated Odyssey level.

## Impact

- Affects Arena workspace routing, the Control Odyssey client flow, and the score-submission server action.
- Adds focused unit and client-flow coverage; it introduces no new dependencies or public API.
