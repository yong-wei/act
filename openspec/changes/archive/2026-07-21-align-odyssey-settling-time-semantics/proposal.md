## Why

Control Odyssey already computes `settlingTime` from the response to the active reference step, while some challenge and documentation wording describes the same value as completion time. This makes a valid 2.8-second settling-time target appear incompatible with the separate 3000-meter traversal and invites changes to otherwise consistent challenge thresholds.

## What Changes

- Define `settlingTime` as the response settling interval after a reference change, not the run's wall-clock completion time.
- Use the Chinese term `调节时间` consistently wherever Odyssey challenge criteria, evaluation details, results, and metric documentation expose `settlingTime`.
- Add regression coverage that distinguishes settling time from distance-based run completion.
- Preserve the 3000-meter route, existing 2.8-second and 9-second thresholds, scoring, credits, unlocks, and Arena submission behavior.

## Capabilities

### New Capabilities
- `control-odyssey-settling-time-semantics`: Defines the authoritative measurement and user-facing terminology for Odyssey settling time, including its independence from distance-based completion.

### Modified Capabilities

None.

## Impact

- Affects Control Odyssey challenge copy, metric descriptions, result presentation, and focused tests.
- May update Arena-facing Odyssey documentation or adapters where `settlingTime` is described to students or evaluators.
- Does not change telemetry field names, persistence schemas, official evaluation APIs, route distance, controller physics, thresholds, or score formulas.
