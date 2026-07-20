## Why

The parameter drawer is rendered through a portal, while its native “响应类型” and “结构” selects depend on theme styles inherited from the page tree. In dark theme this can leave the closed control or the browser-owned option popup with mismatched foreground and background colors, making choices difficult to read.

## What Changes

- Make both parameter-drawer selects readable in light and dark themes across closed, expanded, hover, focus, and disabled states.
- Preserve select value handling and keyboard semantics while giving both the drawer and popup portal content the complete theme-token scope.
- Use the shared Radix Select primitive because Chromium verification demonstrated that the browser-owned native popup cannot provide inspectable DOM or reliable visual-state evidence.
- Add focused source/style checks and Chromium acceptance for both controls, including computed styles, popup appearance, value changes, and keyboard operation.
- Keep analysis state, controller semantics, and Rust/WASM behavior unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `arena-workbench-correction-controls`: Extend the parameter-drawer control contract so its native response-type and correction-structure selects remain readable and operable in both supported themes and portal-rendered states.

## Impact

- Affected UI: `src/features/interactive/multi-representation-linkage/parameter-drawer.tsx` and the existing premium lesson select styles in `src/app/globals.css`.
- Affected verification: focused multi-representation linkage unit/source checks and Playwright coverage for `/interactive-learning/multi-representation-linkage` in Chromium.
- Adds `@radix-ui/react-select`; no public API, persistence, control-analysis, or Rust/WASM changes.
