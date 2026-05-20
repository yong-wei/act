## 1. Drawer Layout Stability

- [x] 1.1 Add tests or assertions covering object tab, correction tab, and correction-state switching.
- [x] 1.2 Stabilize drawer header dimensions so clicking object or correction labels does not resize the top row.
- [x] 1.3 Bound long object names and correction labels without overlap or layout stretch.

## 2. Active State Styling

- [x] 2.1 Add light-theme active, inactive, hover, and focus styles for drawer tabs.
- [x] 2.2 Add dark-theme active, inactive, hover, and focus styles for drawer tabs.
- [x] 2.3 Verify active tab color changes do not affect existing lock state or parameter editing semantics.

## 3. Validation

- [x] 3.1 Run `openspec validate comprehensive-simulation-parameter-drawer --strict`.
- [x] 3.2 Run targeted parameter drawer or correction-control tests.
- [x] 3.3 Run a browser or DOM assertion for the top drawer labels if the component is browser-rendered.
