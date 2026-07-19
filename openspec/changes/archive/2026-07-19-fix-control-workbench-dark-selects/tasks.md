## 1. Portal Theme Scope

- [x] 1.1 Give the parameter-drawer portal content the complete existing premium-lesson theme-token scope without changing its position, dimensions, modal behavior, or wheel containment.
- [x] 1.2 Apply the active light/dark token scope at the portal control boundary and add focused source/style assertions that fail if the scope is removed.

## 2. Native Select States

- [x] 2.1 Update the governed premium select styles so the closed “响应类型” and “结构” controls have readable foreground, background, border, hover, focus-visible, and disabled states in both themes.
- [x] 2.2 Define explicit popup item foreground and background colors while preserving the current values, labels, callbacks, response-type behavior, correction enablement rules, and course-mode disabling.

## 3. Focused Functional Verification

- [x] 3.1 Extend focused parameter-drawer tests to cover both select value sets, change callbacks, focus behavior, and the disabled structure selector without changing analysis or Rust/WASM contracts.
- [x] 3.2 Extend Playwright coverage to assert light/dark computed foreground, background, border, focus, and disabled styles for both controls and verify keyboard value changes through the existing page state.

## 4. Chromium Popup Acceptance

- [x] 4.1 Capture and inspect Chromium evidence for both selectors expanded in light and dark themes, including readable options and distinguishable highlighted or hovered states.
- [x] 4.2 Record whether the scoped native solution passes Chromium acceptance; if it fails reproducibly, replace only these controls with the repository's accessible select primitive and verify identical labels, values, callbacks, disabled rules, focus order, arrow-key selection, Enter/Escape behavior, and portal positioning.
- [x] 4.3 Run the focused unit/source checks and the multi-representation linkage Playwright scenario, then confirm the final diff contains only the approved Radix dependency and no alternate value state model, analysis-request, or Rust/WASM changes.
