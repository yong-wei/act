## Why

The unified control workbench already routes Arena tasks into one shell, but the shell still behaves like a configurable panel container. Arena Pro needs it to guide students through a recognizable control-design process.

## What Changes

- Introduce a workbench design-flow model for challenge, assignment, explore, and review modes.
- Show the current design step and recommended next action in the workbench shell.
- Make preset panels support the flow instead of exposing every configuration with equal priority.

## Capabilities

### New Capabilities

- `control-workbench-design-flow`

### Modified Capabilities

- None.

## Impact

- `src/features/control-workbench/session-resolver.ts`
- `src/features/control-workbench/shell/control-workbench-shell.tsx`
- `src/features/control-workbench/presets/*`
- Workbench shell tests
