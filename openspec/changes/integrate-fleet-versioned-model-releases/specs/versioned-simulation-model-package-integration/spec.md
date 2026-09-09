## ADDED Requirements

### Requirement: Fleet merchant packages use a three-LOD denominator
The system SHALL register LNG、集装箱、破冰船、邮轮与钻井版本化包为原子身份，分母仅为 ship LOD0、LOD1 与 LOD2。collision、payload、demo 与 interactive-systems 仍为 055 可选角色。无这些角色且接口合同武器计数为 0 时，校验 MUST NOT 以 055 武器分母拒绝商船包。任一声明文件缺失、哈希或字节漂移时，接收 MUST fail closed。

#### Scenario: Complete merchant package is received
- **WHEN** a fleet merchant package’s three ship LODs and compact ACT manifest match the declared identities
- **THEN** the system SHALL produce one receipt that binds the three-LOD denominator
- **AND** the package SHALL NOT be required to contain collision, payload, demo, or interactive-systems GLBs

#### Scenario: One merchant LOD drifts
- **WHEN** a declared LOD hash or byte size differs from the descriptor
- **THEN** the system SHALL reject the complete candidate package
- **AND** the current activated default SHALL remain unchanged

### Requirement: Fleet coordinate basis is explicit per package
The system SHALL record each fleet package’s bow axis as `+X` or `+Z`. Scene heading MUST apply one outer yaw `-heading + π/2` and one inner `basisYawRad` (`-π/2` for `+X`, `0` for `+Z`). Versioned mounts MUST scale by declared model length and anchor the declared design waterline. They MUST NOT bbox-center or normalize by maximum dimension.

#### Scenario: Act-forward package is mounted
- **WHEN** an LNG, MSC Tessa, HYSY 981, or Tianjing dredger package is mounted at a platform heading
- **THEN** the outer group yaw SHALL be `-headingRad + π/2`
- **AND** the inner basis yaw SHALL be 0

#### Scenario: Native +X package is mounted
- **WHEN** a Xue Long 2 or Adora Magic City package is mounted at a platform heading
- **THEN** the outer group yaw SHALL be `-headingRad + π/2`
- **AND** the inner basis yaw SHALL be `-π/2`

### Requirement: Live azipod and thruster bindings do not play pose-baking clips
The system SHALL drive Xue Long 2 pods and HYSY 981 thrusters from live telemetry (`azipod` / `thrusters`). Runtime MUST NOT play clips that bake azimuth or propeller spin for those nodes. Display RPM SHALL be derived from thrust ratio and a rated RPM, not from a fake rudder mesh.

#### Scenario: Icebreaker azipods follow telemetry
- **WHEN** the icebreaker simulation advances with finite pod azimuth and thrust
- **THEN** `XL2_POD_P/S` SHALL take the live azimuth
- **AND** `XL2_PROP_P/S` SHALL spin from the display RPM
- **AND** `pod_*_azimuth` and `propeller_*_spin` demonstration clips SHALL remain stopped

#### Scenario: Drilling thrusters follow telemetry
- **WHEN** the drilling simulation advances with eight thruster states
- **THEN** each `Thruster_N_AzimuthPivot` SHALL take that thruster’s azimuth in radians
- **AND** each `Thruster_N_SpinPivot` SHALL spin from that thruster’s display RPM
- **AND** `Thruster01-08Cycle` clips SHALL remain stopped

### Requirement: Attainment easter eggs play a random subset of main-ship clips
When a fleet package has no demo role, the system SHALL on each new task-attainment count play a random non-empty subset of declared `easterEgg.attainmentClips` on the main-ship mixer as LoopOnce. Trigger MUST be task attainment, not clock end or a manual stop. Clips MUST be visual-only and MUST NOT write back into the physics state.

#### Scenario: Icebreaker attains a heading task
- **WHEN** heading error stays within the deadzone for the declared dwell after a commanded heading change
- **THEN** the visual layer SHALL increment attainedCount
- **AND** the mixer SHALL play one or more of the declared crane/rotor clips once

#### Scenario: Drilling platform holds station
- **WHEN** position and heading remain inside the station-keep deadzone for the declared dwell
- **THEN** the visual layer SHALL increment attainedCount
- **AND** the mixer SHALL play one or more of the declared crane/door/top-drive clips once

### Requirement: Tianjing dredger uses the v1.0.1 three-LOD GLB package
The system SHALL register `dredger-tianjing` 1.0.1 as a fleet merchant package with ship-lod0/1/2 artifacts received from `3DModels:models/act-dredger-tianjing/exports/v1.0.1`. The activated default MUST point at `/assets/model-releases/dredger-tianjing/v1.0.1`. Runtime MUST load the Meshopt act-forward GLBs through the shared fleet mount. It MUST NOT vendor or execute the procedural `createDredgerModel` factory. Visual scale MUST use the package hull approximation of 120 m and MUST NOT stretch the mesh to the public 127.5 m length or an activity bounding box.

#### Scenario: Dredger activation uses the received LOD denominator
- **WHEN** `dredger` is activated
- **THEN** the descriptor SHALL declare ship-lod0, ship-lod1, and ship-lod2
- **AND** `runtime` SHALL be absent
- **AND** homepage preview SHALL use `shipLodUrlForQualityTier` at the low tier
- **AND** `modelLengthMeters` SHALL be 120
