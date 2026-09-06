# server-control-engine-consumers Specification

## Purpose
TBD - created by archiving change consolidate-server-control-engine-consumers. Update Purpose after archive.
## Requirements
### Requirement: The four server consumer classes use the stable server facade

Generic analysis, simulation virtual runtime, Control Odyssey server execution, and Arena control-analysis service SHALL invoke the stable control-engine server facade. These consumers SHALL NOT import or initialize generated WASM modules independently.

#### Scenario: Generic analysis route runs

- **WHEN** `/api/simulation/runs` receives a supported analysis request
- **THEN** it SHALL obtain the numerical result through the server facade
- **AND** SimulationRun persistence SHALL retain its existing owner, task, protocol, and summary semantics.

#### Scenario: Arena analysis service runs

- **WHEN** an Arena evaluator requests supported white-box analysis
- **THEN** its `ControlAnalysisService` SHALL delegate numerical execution to the server facade
- **AND** Arena evaluation SHALL retain its own evaluator and persistence authority.

### Requirement: Arena official evaluation remains an independent server authority

The official Arena evaluator SHALL remain responsible for task/protocol selection, hidden scenario or private model resolution, metric extraction, hard constraints, score, validity, and official `ArenaEvaluationRun`/`ArenaSubmission` effects. The shared server facade SHALL provide numerical execution only.

#### Scenario: Official white-box evaluation completes

- **WHEN** an accepted artifact is evaluated under `analysis-whitebox-v1` or `template-whitebox-v1`
- **THEN** the Arena evaluator SHALL derive official metrics and constraints from server-owned execution
- **AND** a generic simulation or client result SHALL not become the official score.

#### Scenario: Historical evaluation is read

- **WHEN** a historical accepted `ArenaEvaluationRun` or `ArenaSubmission` is loaded after consumer migration
- **THEN** its stored protocol, score, validity, and metrics SHALL remain unchanged
- **AND** the system SHALL not silently re-evaluate it under the new facade.

### Requirement: Hidden official inputs stay server-only

Official Arena execution SHALL keep hidden scenario parameters, private datasets/models, reference trajectories, and evaluator tests inside the server authority. Client-provided score, trace, parameters, preview results, and claims SHALL NOT be official evaluation inputs.

#### Scenario: Client submits a forged preview result

- **WHEN** a client request contains a score, trace, or parameters that differ from the server-owned artifact or hidden execution
- **THEN** official evaluation SHALL ignore or reject those values before metric/constraint computation
- **AND** the official result SHALL be derived from server-owned inputs.

#### Scenario: Hidden execution is unavailable

- **WHEN** the server cannot resolve a required private dataset/model/scenario or control-engine runtime
- **THEN** official evaluation SHALL fail closed
- **AND** it SHALL not use preview, client, zero, or heuristic values as official input.

### Requirement: Virtual preview persistence uses the server facade

The `/api/arena/virtual-simulation-runs` route SHALL use the R1 server facade for artifact/task validation, authorized Rust recomputation, trace and summary derivation, checksum calculation, and persistence of `ArenaVirtualSimulationRun` and its canonical preview `SimulationRun`. Browser or worker facade output SHALL be display-only and non-persistent. The server SHALL reject client-provided `trace`, `summary`, or `checksum` fields before numerical execution or writing.

#### Scenario: Server virtual preview is persisted

- **WHEN** the virtual-preview route receives an allowed task and artifact
- **THEN** the server facade SHALL perform validation, Rust execution, trace/summary derivation, checksum calculation, and the existing preview write
- **AND** the result envelope SHALL identify the actual `executor` and `authoritySource` as server-facade values.

#### Scenario: Browser facade is used for display

- **WHEN** a browser or worker facade renders a supported preview
- **THEN** it SHALL return a non-persistent display result with `persisted=false`
- **AND** it SHALL not invoke any `ArenaVirtualSimulationRun`, `SimulationRun`, checksum, or evidence writer.

#### Scenario: Client preview result is tampered

- **WHEN** a client submits `trace`, `summary`, or `checksum` with a virtual-preview request
- **THEN** the route SHALL reject the request before numerical execution and persistence
- **AND** no client-provided field SHALL be used for preview or official evaluation.

### Requirement: Server model claims match Rust inputs

The server consumer SHALL record `modelRelation=surrogate`, governed teaching semantics, and `prohibitsMixedClaims=true` for a fixed surrogate. A result SHALL claim an identified model only when an authorized model parameter/snapshot is actually consumed by the Rust capability; a relation label, hash, or client assertion without Rust input SHALL be invalid.

#### Scenario: Surrogate cannot claim an identified model

- **WHEN** a fixed surrogate preview or server result is labeled as an identified model by a client or adapter
- **THEN** validation SHALL reject or downgrade the claim to non-authoritative surrogate metadata
- **AND** it SHALL not persist an identified-model result or official evaluation.

#### Scenario: Authorized identified parameters affect execution

- **WHEN** an identified model capability is selected
- **THEN** the server SHALL resolve authorized model parameters and pass them into the Rust numerical request
- **AND** a missing, mismatched, or metadata-only parameter set SHALL return unavailable/invalid without a persisted result.

#### Scenario: Identity is not part of computation

- **WHEN** the task, spec, artifact, or model identity changes while numerical inputs remain otherwise equal
- **THEN** canonical request, cache/checksum binding, or result verification SHALL detect the identity change
- **AND** the server SHALL not reuse the prior result solely because the identity was stored as metadata.

### Requirement: Protocol and cache identities remain isolated

Arena evaluation and numerical caches SHALL retain `taskId`, `artifactHash`, and `protocolVersion` as the minimum isolation identity. `analysis-whitebox-v1`, `template-whitebox-v1`, and `blackbox-official-v1` results SHALL not be reused across protocols or with preview results.

#### Scenario: Same artifact is evaluated under two protocols

- **WHEN** an artifact is submitted under different supported protocol versions
- **THEN** each protocol SHALL resolve its own server result or explicitly versioned cache entry
- **AND** one protocol's result SHALL not satisfy the other protocol's official evaluation.

#### Scenario: Cache identity is incomplete

- **WHEN** a cache entry lacks task, artifact, or protocol identity or conflicts with runtime/model/spec metadata
- **THEN** the entry SHALL be treated as a miss or invalid
- **AND** the evaluator SHALL not use it as an official result.

### Requirement: Server runtime failures are controlled and non-authoritative

A server facade error, timeout, unavailable generated package, or non-finite result SHALL produce a bounded failure state. It SHALL NOT be converted to a client fallback, stale numerical result, zero-filled official result, or successful evidence-bearing run.

#### Scenario: Simulation server runtime times out

- **WHEN** a virtual simulation server call exceeds its declared timeout
- **THEN** the route SHALL return a controlled unavailable/error response
- **AND** it SHALL not persist an authoritative SimulationRun result from the timeout.

#### Scenario: Server result contains non-finite values

- **WHEN** the facade returns a non-finite numerical result
- **THEN** the consumer SHALL mark the execution invalid or unavailable
- **AND** it SHALL not write official score, validity, constraints, or leaderboard data from that result.

### Requirement: Consumer enforcement does not retain a test-only registry

Control Engine SHALL 删除无生产消费者的 `server-consumers.ts` 登记表、对应公开导出和仅验证该表的源码扫描测试。生产消费者 SHALL 继续直接使用现有 server façade；现有 generated-import 检查与实际执行测试 SHALL 保持有效。

#### Scenario: A registry is referenced only by its own test

- **WHEN** 登记表仅被测试和过期文档引用，生产代码不读取它
- **THEN** 登记表、对应测试、导出及过期文档说明 SHALL 一起删除或修订
- **AND** 系统 SHALL NOT 为保留该测试而恢复登记表或新建替代清单

#### Scenario: Current numerical and authority behavior is verified

- **WHEN** 删除完成后运行 façade、simulation、Practice、Odyssey 和 Arena 相关测试
- **THEN** 服务端数值执行、客户端伪造结果拒绝、预览持久化及官方评分隔离 SHALL 保持
- **AND** 生成包过期时 SHALL 修复测试环境或报告失败，不得跳过身份校验

