## ADDED Requirements

### Requirement: Parameter drawer selects are theme-readable and preserve selection behavior
The parameter drawer SHALL keep its response-type and correction-structure selectors readable and operable in light and dark themes when rendered through a portal. The selectors SHALL preserve their existing values, labels, change behavior, keyboard semantics, and disabled rules, and SHALL NOT alter workbench analysis state or Rust/WASM control behavior.

#### Scenario: Closed selectors are readable in both themes
- **WHEN** the parameter drawer renders “响应类型” or “结构” in light or dark theme
- **THEN** the closed selector SHALL use a readable foreground and background from the active theme
- **AND** its border, hover, and focus-visible states SHALL remain distinguishable.

#### Scenario: Expanded options are readable in Chromium
- **WHEN** a user expands either selector in Chromium in light or dark theme
- **THEN** every visible option SHALL have readable foreground and background colors consistent with the active theme
- **AND** the highlighted or hovered option SHALL remain distinguishable from unselected options.

#### Scenario: Keyboard selection preserves behavior
- **WHEN** a keyboard user focuses either selector and changes the selection with Arrow and Enter controls or dismisses the popup with Escape
- **THEN** focus SHALL remain visible and the selected response type or correction structure SHALL update through the existing change callback
- **AND** the selector SHALL retain its accessible label and expected keyboard semantics.

#### Scenario: Disabled structure remains readable
- **WHEN** correction is disabled or course mode makes the “结构” selector disabled
- **THEN** the selector SHALL visibly communicate its disabled state without making the selected value unreadable
- **AND** keyboard or pointer input SHALL NOT change its value.

#### Scenario: Select styling does not change control analysis
- **WHEN** theme or selector visual state changes without a value change
- **THEN** the current response type, correction structure, parameter state, and generated analysis request SHALL remain unchanged
- **AND** no Rust/WASM interface or numerical result SHALL be modified by the styling change.
