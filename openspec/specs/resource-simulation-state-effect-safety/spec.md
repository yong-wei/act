# resource-simulation-state-effect-safety Specification

## Purpose
Define the state and effect safety contract for legacy resource decks, reusable widgets, simulations, and control-system UI so React state repairs preserve local interactions, dispose UI resources, and do not alter numerical model semantics.
## Requirements
### Requirement: Resource components avoid stale prop-synced state
The system SHALL avoid effect-driven prop-to-state synchronization in resource, widget, and simulation components when state can be derived, keyed, or adjusted without a stale intermediate render.

#### Scenario: Resource identity changes
- **WHEN** a legacy resource, widget, or simulation preview receives a new resource identity, selected item, scenario, or model reference
- **THEN** dependent UI state SHALL reset or derive from the new identity without showing stale state

#### Scenario: Resource parent re-renders same identity
- **WHEN** a resource parent re-renders without changing the owning identity
- **THEN** local user interaction state SHALL remain stable

### Requirement: Simulation state/effect repairs preserve numerical semantics
The system SHALL preserve simulation and control numerical semantics when repairing React state/effect diagnostics in simulation UI files.

#### Scenario: Simulation UI state is refactored
- **WHEN** a simulation component changes UI state reset, effect cleanup, or dependency logic
- **THEN** the underlying control model, physics model, step timing semantics, and displayed metric meaning SHALL remain unchanged

### Requirement: Resource effects clean up resources
The system SHALL clean up timers, animation frames, listeners, subscriptions, and similar resources created by resource, widget, or simulation effects.

#### Scenario: Resource unmounts during animation or delayed UI feedback
- **WHEN** a resource, widget, or simulation component unmounts while a timer, animation frame, or listener is active
- **THEN** the resource SHALL dispose that callback or listener without updating unmounted state

### Requirement: Resource state/effect React Doctor validation is local and version-pinned
The system SHALL validate this change with React Doctor `0.5.1` in local error-only mode.

#### Scenario: Developer validates resource state/effect cleanup
- **WHEN** a developer runs `npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .`
- **THEN** the report SHALL contain no state/effect diagnostics for files covered by this change

### Requirement: Resource React Doctor error baseline is cleared
The system SHALL clear React Doctor error diagnostics under resource, widget, simulation, and control-system resource files without weakening React Doctor error rules.

#### Scenario: Developer validates resource error cleanup
- **WHEN** a developer runs the owned-surface React Doctor error gate
- **THEN** the report SHALL contain zero error diagnostics for `src/resources/interactive-learning/**`, `src/resources/simulations/**`, `src/resources/widgets/**`, and `src/resources/control-system/**`
- **AND** resource fixes SHALL NOT change declared course content, scoring, numerical model semantics, or metric definitions

### Requirement: Resource identity resets are explicit
Resource components SHALL reset local UI state only on explicit resource, model, scenario, slide, or activity identity changes.

#### Scenario: Resource parent rerenders same identity
- **WHEN** a parent rerenders a resource component without changing the owning identity
- **THEN** local user interaction state SHALL remain stable

#### Scenario: Resource identity changes
- **WHEN** the owning resource, model, scenario, slide, or activity identity changes
- **THEN** dependent UI state SHALL reset deliberately without showing stale state from the previous identity

### Requirement: Resource side effects dispose callbacks
Resource, widget, and simulation components SHALL dispose timers, animation frames, subscriptions, event listeners, and delayed callbacks created by effects.

#### Scenario: Simulation unmounts during delayed update
- **WHEN** a simulation or resource unmounts while a delayed callback is pending
- **THEN** the callback SHALL be canceled or guarded so it does not update unmounted or stale state

### Requirement: R3F and Three warnings are classified before remediation
Resource simulation React Doctor warning remediation SHALL classify R3F/Three JSX diagnostics before code changes are made.

#### Scenario: Scanner reports unknown properties in a Three scene
- **WHEN** React Doctor reports `no-unknown-property` for R3F intrinsic elements or custom shader materials
- **THEN** the finding SHALL be classified as scanner-noise candidate, real DOM defect, or implementation defect
- **AND** scanner-noise candidates SHALL require representative scene evidence before being accepted.

### Requirement: Resource warning remediation preserves simulation semantics
Resource and simulation warning cleanup SHALL preserve model, scene, and metric semantics.

#### Scenario: Simulation resource code is touched
- **WHEN** a simulation component changes because of warning remediation
- **THEN** R3F scanner-noise classifications SHALL include representative nonblank scene evidence and no new console or runtime errors
- **AND** any change touching model, metric, clock, scenario, controller, or physics semantics SHALL include numerical or metric regression evidence proving the displayed metric meaning is unchanged.

### Requirement: Simulation detail routes are free of shared page errors
Simulation detail routes SHALL render without the shared `classList` null page error observed in the 2026-06-15 audit.

#### Scenario: Simulation detail route is captured
- **WHEN** local browser QA opens any active `/simulations/*` detail route
- **THEN** the browser page-error log SHALL NOT contain `Cannot read properties of null (reading 'classList')`
- **AND** any replacement defensive logic SHALL preserve the intended shell, theme, dock, panel, and local-tool behavior.

### Requirement: Simulation Three.js integration avoids known deprecated APIs
Simulation rendering integration SHALL avoid known Three.js API usage that produces deprecation warnings in the current runtime baseline.

#### Scenario: Simulation detail route renders a 3D scene
- **WHEN** local browser QA opens a simulation detail route with a Three.js scene
- **THEN** the console log SHALL NOT contain `THREE.Clock: This module has been deprecated`
- **AND** the console log SHALL NOT contain `THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated`
- **AND** the replacement timing and shadow behavior SHALL preserve visible scene rendering and interaction.

### Requirement: Runtime-noise fixes preserve simulation state semantics
Runtime-noise cleanup SHALL NOT change simulation state update semantics, control inputs, telemetry summaries, or evidence recording.

#### Scenario: Runtime-noise cleanup is reviewed
- **WHEN** a simulation page is updated to remove page errors or deprecation warnings
- **THEN** tests or reviewer evidence SHALL confirm that controller inputs, pause/start/reset behavior, telemetry display, and trace/evidence boundaries remain functionally equivalent.

### Requirement: 仿真循环 effect 引用稳定且时钟守恒

仿真页面的推进循环 SHALL 使用稳定引用：回调与启动 effect 的依赖不得包含每帧变化的状态；运行期间 MUST NOT 因 effect 重建而重置固定步长 accumulator 或重定时间基线。1.0x 倍速下，正常帧率时仿真时钟与墙钟的偏差 SHALL 小于 5%。

#### Scenario: 一倍速时钟近似实时

- **WHEN** 以 1.0x 运行仿真 60 秒（正常帧率）
- **THEN** 仿真时钟读数与墙钟偏差小于 5%
- **AND** 控制与数值行为不因调度改动而变化

#### Scenario: 运行期间循环不被状态更新重建

- **WHEN** 仿真运行中每帧状态更新触发渲染
- **THEN** 推进循环的 effect 不 teardown/重建
- **AND** accumulator 余数跨帧保留，不被 reset 丢弃

