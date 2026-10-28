## ADDED Requirements

### Requirement: Interactive tool pages render inside the Interactive Learning shell
The PID control simulator and control theory map routes SHALL render inside `InteractiveLearningShell` with platform navigation, breadcrumbs, and the theme switch, and SHALL NOT be registered as legacy demo shell exceptions.

#### Scenario: Student opens a tool page
- **WHEN** a student opens `/interactive-learning/pid-simulator` or `/interactive-learning/control-map`
- **THEN** the page SHALL show the platform sidebar, a breadcrumb trail through 互动学习, and the theme switch followed by the personal center action
- **AND** the AppShell route coverage scanner SHALL classify the route as shell-covered rather than as a governed exception.

### Requirement: Interactive tool pages use theme tokens
Tool page surfaces, text, borders, chart series, and knowledge-zone colors SHALL derive from platform tokens so that every label, series, and legend remains readable in both light and dark themes.

#### Scenario: Theme changes
- **WHEN** the learner switches between light and dark themes
- **THEN** node labels, legends, chart axes, chart series, and readouts SHALL update to the active theme without hard-coded dark-only colors.

### Requirement: PID simulator previews immediately and records explicitly
The PID simulator SHALL show the response for the current parameters as soon as the simulation runtime is ready, SHALL refresh the preview after parameter changes, and SHALL report results to host callbacks only when the learner explicitly records a result.

#### Scenario: Page opens
- **WHEN** the PID simulator mounts and the runtime is ready
- **THEN** the response curve and the overshoot, steady-state error, and final value readouts SHALL show the default parameter result without requiring a button press.

#### Scenario: Learner adjusts a parameter
- **WHEN** the learner changes Kp, Ki, Kd, the target value, the plant, or the duration
- **THEN** the preview SHALL refresh with the new result
- **AND** neither `onStateChange` nor `onComplete` SHALL be called by the preview.

#### Scenario: Host provides callbacks
- **WHEN** the host passes `onStateChange` or `onComplete` and the learner activates 记录本次结果
- **THEN** the simulator SHALL call the provided callbacks once with the latest result's parameters and metrics.

#### Scenario: Host provides no callbacks
- **WHEN** the simulator renders without `onStateChange` and `onComplete`
- **THEN** the record action SHALL NOT be shown.

### Requirement: PID simulator hides numerical implementation settings
The PID simulator SHALL expose simulation duration as a learner setting and SHALL NOT expose the integration step or a time-scale multiplier.

#### Scenario: Learner views simulation settings
- **WHEN** the learner views the simulator controls
- **THEN** the controls SHALL offer a duration choice
- **AND** SHALL NOT show 步长 or 时间倍率 inputs.

### Requirement: PID simulator flags divergent responses
The PID simulator SHALL identify a divergent closed-loop response and keep the chart readable.

#### Scenario: Parameters destabilize the loop
- **WHEN** the response contains non-finite values or its peak magnitude exceeds the divergence bound
- **THEN** the simulator SHALL show the notice 当前参数使闭环发散
- **AND** SHALL clamp the chart vertical range around the target value.

#### Scenario: Oscillation keeps growing within the bound
- **WHEN** the largest deviation from the target in the final quarter of the window exceeds the largest earlier deviation by more than 5%
- **THEN** the simulator SHALL show the notice 当前参数使闭环发散
- **AND** SHALL keep the chart vertical range automatic so the growing envelope stays visible.

#### Scenario: Stable response
- **WHEN** the closed loop is stable
- **THEN** the simulator SHALL NOT show the divergence notice.

### Requirement: Control map colors nodes by knowledge zone
Control theory map nodes SHALL always display their knowledge-zone color, and selection or relation highlighting SHALL add emphasis without removing the zone color.

#### Scenario: Map renders without selection
- **WHEN** the control map renders with no selected or hovered node
- **THEN** every node SHALL show its zone color, matching the zone legend.

### Requirement: Control map filters keep at least one option per group
Each control map filter group SHALL keep at least one option active.

#### Scenario: Learner tries to clear a group
- **WHEN** only one option remains active in the domain or time group and the learner activates it
- **THEN** the option SHALL remain active
- **AND** the control SHALL communicate that at least one option must remain.

### Requirement: Control map search reports and locates matches
The control map search SHALL report the number of matching concepts, SHALL state when nothing matches, and SHALL locate the first match on Enter.

#### Scenario: Learner searches
- **WHEN** the learner types a query
- **THEN** the toolbar SHALL show the match count, or 未找到匹配概念 when the count is zero.

#### Scenario: Learner presses Enter
- **WHEN** at least one concept matches and the learner presses Enter in the search field
- **THEN** the first matching concept SHALL become selected, its detail panel SHALL open, and the canvas SHALL move to it.

#### Scenario: Learner presses Escape
- **WHEN** the detail panel is open and the learner presses Escape
- **THEN** the detail panel SHALL close and the selection SHALL clear.
