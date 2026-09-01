## Why

The active canvas imports the legacy Force Graph libraries but fixes every ordinary node with automatic `fx`/`fy`/`fz` anchors and configures zero cooldown ticks, so force parameters cannot move the graph. The second migration therefore changed the renderer name without delivering force reflow, stable dynamic labels, or the old interaction contract already claimed by the archived specification.

## What Changes

- Restore a real bounded force simulation for ordinary domain and neighborhood nodes in both 2D and 3D while keeping root navigation packing deterministic and line-free.
- Distinguish deterministic initial seeds, user pins, temporary drag coordinates, and live force coordinates; only explicit user pins and governed root entries may remain fixed.
- Reheat only affected neighborhoods after bounded shard arrival, settle within measured tick/time budgets, and preserve unaffected coordinates, camera, filters, selection, and inspector state.
- Make domain-concept labels visible by default at the overview level and apply one shared collision/LOD policy to text and rich labels without reducing ordinary labels to selected-only behavior.
- Replace source-string tests for zero ticks with behavioral tests proving node displacement, collision separation, drag/pin/unpin, reflow, 2D/3D state isolation, and bounded CPU/frame cost.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `active-authority-legacy-force-runtime`: Require genuine force movement, bounded reheat and explicit pin ownership rather than static-coordinate rendering through a Force Graph component.
- `active-authority-semantic-graph-presentation`: Require readable default concept labels and real legacy-interaction parity in every active domain.

## Impact

- Affects the shared 2D/3D runtime, layout state, automatic-anchor handling, camera fit, label placement, motion snapshots, and active runtime adapter.
- Must preserve Legacy data/session isolation, active Authority identity, root packing, accessibility, and all user-created pins.
- Depends on `establish-three-level-authority-graph-navigation`; it must not compensate for full-domain payloads by weakening force or label behavior.
