## Why

Arena currently presents challenge tasks as a filtered list. The Arena Pro plan requires students to see a control-design training path: what each task trains, what prerequisite capability it assumes, and which challenge should come next.

## What Changes

- Add training metadata for Arena challenges: capability tags, prerequisites, training stage, estimated effort, hidden-test signal, and common failure points.
- Upgrade the Arena hall from task browsing to a capability training map with stage groups and recommended next challenges.
- Surface training goals and prerequisites on challenge detail pages without changing official evaluation behavior.

## Capabilities

### New Capabilities

- `arena-training-map`

### Modified Capabilities

- None.

## Impact

- `src/features/arena/types.ts`
- `src/features/arena/data/seed-challenges.ts`
- `src/features/arena/arena-hall.tsx`
- `src/features/arena/challenge-detail.tsx`
- Arena hall and challenge detail tests
