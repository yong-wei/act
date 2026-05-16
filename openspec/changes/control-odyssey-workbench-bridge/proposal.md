## Why

Control Odyssey has its own game loop, score, progression, and interaction model. It should be connected to Arena through a bridge after the unified workbench is stable, not forced into the generic shell too early.

## What Changes

- Add an Odyssey workbench bridge that can render Arena challenge context around Odyssey without breaking the game experience.
- Keep Odyssey game score and original progression independent from Arena official submissions.
- Map completed Odyssey results to Arena-compatible controller artifacts or submission summaries.
- Submit Arena results through `/api/arena/evaluate` or a dedicated Arena adapter that preserves the same official submission contract.
- Allow routing migration to move Odyssey only after the bridge is implemented.

## Capabilities

### New Capabilities
- `control-workbench-odyssey-bridge`: Defines how Control Odyssey integrates with unified Arena workbench context, original game progression, and official Arena submission.

### Modified Capabilities

## Impact

- Touches `/interactive-learning/control-odyssey`, Control Odyssey runtime/store components, and Arena submission bridge code.
- Must preserve existing Odyssey game progression and scoring behavior.
- No change to code-controller sandbox policy.
