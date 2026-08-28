## Context

仓库已经有 `ArenaControllerArtifact`、`ArenaEvaluationRun`、`ArenaSubmission`、`ArenaVirtualSimulationRun`、`SimulationTaskSpec`、`SimulationRun` 和 `SimulationTrace`。Arena preview store 会创建 `runKind=arena_preview` 的 SimulationRun；Practice 与 standalone scene 运行也使用 SimulationRun，但字段组合、visibility 和 controller snapshot 的来源仍由各 consumer 自己解释。`simulation-scene-trace-protocol` 已定义 SceneSpec/Trace/EvaluationSpec，`simulation-runtime-replayability` 已定义 seed/version/checksum，新的合同应做一致投影，而非复制它们。

### Owner and denominator

| object/surface | record owner and authority | denominator to freeze |
| --- | --- | --- |
| `ArenaControllerArtifact` | artifact owner (`ownerId`)；Arena artifact authority | all artifact builders/mappers and `ArenaControllerArtifact` writes |
| `ArenaSubmission` | submitting student (`userId`)；Arena submission authority | `/api/arena/evaluate`, `/api/arena/submissions` and submission stores/tests |
| `ArenaEvaluationRun` | Arena evaluator/task authority；面向用户的 owner 只能经 accepted submission 关联解析 | official evaluator, protocol persistence and leaderboard readers; no owner collapse |
| `ArenaVirtualSimulationRun` | student (`userId`)；preview detail authority | black-box preview route, adapter, store, replay/profile/evidence consumers |
| `SimulationRun/Trace` | `ownerUserId` (可为 teacher/system batch)；canonical run/trace authority | `/api/simulation/runs`, preview store, scene persistence, replay/evidence writers |
| Practice live outcome | Practice owner/student and its own run kind | standalone `/simulations/*`, Practice hooks/scenes, result/event writers |

Routes、API handlers、Prisma access、scripts、tests 和 callers 以 captured tree 的完整读写图为分母；不能只枚举直接 `SimulationRun.create`，还要纳入 payload 组装、replay/evidence 读取和 profile/leaderboard 投影。

## Goals / Non-Goals

**Goals:**

- 给每类记录提供同一份逻辑身份 envelope 和规范化 hash/revision 字段。
- 保留 source record owner、source domain、source reference 和各自 persistence authority，保证跨入口重复处理可幂等。
- 明确 parameter/result visibility、preview/Practice/official eligibility 和 hidden-input exclusion。
- 让 replay/evidence/consumer 能验证同一 task/spec/artifact/run 的 provenance，而不读取黑箱隐藏数据。

**Non-Goals:**

- 不创建 `PracticeRun` 或统一替代现有 Prisma 模型；不把不同 owner 合并为一个全局 user 字段。
- 不改变 Arena 官方 score、validity、hard constraints、leaderboard policy、官方协议或 hidden scenario。
- 不迁移所有 numerical consumer；R3-R5 才逐批接入 façade 和 run contract。
- 不删除 `SimulationSession`/`SimulationLog`；是否退役留给 R6 的独立证明。

## Decisions

### 1. 逻辑 envelope，不新增持久化 schema

定义可版本化的 `ArtifactRunIdentity`/`RunOutcomeEnvelope` 作为 DTO、writer 输入和验证器。它对现有记录做投影：`sourceKind`、`sourceId`、`ownerRef`、`taskId`、`specHash`、`artifactHash`、`controllerSnapshotRef`、`protocolVersion`、`runtimeVersion`、`modelVersion`、`controllerSchemaVersion`、`executor`、`authoritySource`、`modelRelation`、`teachingSemantics`、`prohibitsMixedClaims`、`parameterVisibility`、`resultVisibility`、`evaluationVisibility`、`officialEligible`、`seed`、`checksum` 和 `toleranceProfile`。

不会增加一张通用 run 表，也不会复制 SceneSpec/Trace 结构。每个 owner 继续写自己的模型；公共 envelope 只约束映射、验证和下游消费。

### 2. Owner 与 authority 分开表达

`ownerRef` 表示学生、班级、teacher batch 或 system scope；`authority` 表示该记录由 Practice、Arena artifact、Arena evaluator、Arena submission 或 Simulation run 哪个边界产生。`executor` 必须记录实际执行边界（`browser`、`worker`、`server`），`authoritySource` 必须记录实际产生结果的受信边界，不能由客户端自报。`ArenaEvaluationRun` 可能被多个同一 task/artifact/protocol 的 submission 引用，因此其记录 authority 是 Arena evaluator；向学生投影 official result 时必须通过 accepted `ArenaSubmission.userId` 建立 owner 关系，不能把共享 evaluation row 当成独立学生 run，也不能把未绑定 evaluation 当作完成证据。

### 3. Revision/hash 构成不可变 identity

`specHash` 绑定 task/scene/evaluation spec，`artifactHash` 或 `controllerSnapshotRef` 绑定实际 controller，protocol/runtime/model/controller schema revision 绑定执行语义，seed/checksum 绑定 replay。写入前校验所有字段来自同一 capture/revision；字段冲突、缺失或重放 checksum 不匹配时 fail closed，不重算历史 accepted result。

参数可见性与结果可见性独立：白箱 public 参数可以是 `public`，黑箱 hidden model/scenario 永远是 `private`；高频 trace 只能用 `traceRef` 和 compact summary 暴露。

### 4. Preview 与 Practice 永远不可升级为 official

`ArenaVirtualSimulationRun` 与 `SimulationRun(runKind=arena_preview)` 固定 preview envelope，写入 datasetHash、controllerHash、model/sourceExperiment 关系和 `officialEligible=false`。browser/worker facade 只能产生 `persisted=false` 的展示投影；`/api/arena/virtual-simulation-runs` 的持久化校验、Rust 重算、trace/summary 生成、checksum 计算和写入必须使用 `executor=server`、`authoritySource=control-engine-server-facade`。该 route 拒收 client `trace`、`summary`、`checksum`，不得把它们作为重算或写入输入。Practice run 的 outcome 只能进入 Practice/evidence 相关 consumer，`officialEligible=false` 且不能写 `ArenaSubmission`、`ArenaEvaluationRun` 或 leaderboard。只有 server-owned Arena evaluator 从 accepted submission 产生 official score/validity/constraints。

### 5. Hidden input 的契约是拒绝而非脱敏后写入

公共 envelope 不携带 hidden scenario 参数、reference trajectory、私有 dataset payload、识别模型内部参数或原始答案。服务端可以在 private execution context 使用它们，但只把 coarse identity/hash、visibility 和安全 summary 写入 envelope；若 consumer 试图把 hidden payload 放进 public DTO，contract test 必须拒绝。`modelRelation=surrogate` 时必须同时记录 `teachingSemantics` 与 `prohibitsMixedClaims=true`；若声称 `identified`，server 必须解析授权 model snapshot/parameters，且 Rust capability 必须实际消费该参数，不能只在 envelope 中写 relation 或 hash。

### 6. Virtual preview persistence and model claims are server-validated

`/api/arena/virtual-simulation-runs` 的 request 只携带 task/artifact 以及允许的公开 preview input。它先拒绝任何 client `trace`、`summary`、`checksum` 或 hidden field，再由 R1 server facade 校验 artifact/spec/model identity、执行 Rust capability、生成 trace/summary、计算 checksum，最后调用既有 preview writer。browser/worker facade 没有 persistence、checksum writer 或 evidence writer 权限，只能返回带 `persisted=false` 的 display envelope。

`executor` 和 `authoritySource` 必须由实际 adapter 写入并由 validator 复核；客户端修改这两个字段、预计算结果或 checksum 均视为篡改。固定 surrogate 的 `modelRelation=surrogate`、教学语义和 `prohibitsMixedClaims=true` 是 hard contract；当请求标记 identified 时，Rust request 必须含已授权且与 model identity 绑定的参数，并通过 capability test 证明参数改变会影响计算或导致明确的 identity mismatch。未满足时返回 unavailable/invalid，不生成持久 run。

## Hard / Contract / Soft / Delete boundaries

| class | boundary | rule |
| --- | --- | --- |
| hard | owner/authority、executor/authoritySource、task/spec/artifact identity、visibility、official eligibility、seed/checksum、hidden-input privacy、modelRelation claims | 写入或投影不满足即拒绝；官方 score 只来自 Arena server authority |
| contract | envelope version、revision names、source mapping、traceRef/summary、model relation/teaching semantics、tolerance profile | 版本化 DTO 和 deterministic canonicalization，跨 consumer 只读 |
| soft | UI label、preview explanation、metric formatting、non-authoritative diagnostics | 可调整但不能改变 hard fields |
| delete | ad hoc identity aliases、重复 payload-derived hashes、未绑定 forwarder | 只有零 caller、双读验证和 R6 退役条件成立后删除；本 change 不删现有模型 |

## Vertical slice and no-facade proof

本 change 的 vertical slice 是 Arena black-box preview：`ControllerArtifact` → owned experiment/model references → server façade validation/recompute → `ArenaVirtualSimulationRun` → canonical `SimulationRun/Trace` → preview/evidence projection。它同时证明 datasetHash、controllerHash、sourceExperimentId、seed、checksum、executor、authoritySource、preview visibility 和 owner 在一条链路上保持一致，并证明 browser facade 不写入、client trace/summary/checksum 被拒收。

Practice live、Arena official 和 generic simulation 作为同一 validator 的 fixtures 验证，而不在本 change 中迁移 numerical code。no-facade 证明包括：只存在一份 envelope/schema/hasher；每个现有 model 只有一个 source-of-truth writer；官方 evaluator、preview store、Practice writer 的 source mapping 可逆；任何 public DTO 都不含 hidden payload；不新增 `PracticeRun`/第二套 run table；identity 改变会触发 canonical input/cache/checksum/result verification 变化，surrogate 不得声称 identified。

## Migration Plan

1. 在 clean `a3e6ce743` 上冻结模型字段、route/API、writer/reader、script 和 test denominator，生成 source mapping matrix。
2. 定义 envelope、canonical hash、visibility/owner/executor/authoritySource validator 和 model-specific adapters，先接入 preview vertical slice。
3. 让 virtual-preview route 先拒收 client result fields，再由 server facade 完成校验、Rust 重算、checksum 和既有 writer 写入；browser facade 保持 display-only。
4. 对既有 rows 使用只读 projection/backfill-free validation；历史 `ArenaEvaluationRun`、`ArenaSubmission`、`SimulationRun` 不重算、不改 owner、不重写 payload。
5. 将 envelope contract 交给 R3-R5，分别接入 server facade、Arena preview numerics 和 Practice live numerics。

Rollback 仅移除新增 DTO/validator 和未启用的 writer adapter；旧模型及旧读取路径保持可读。若发现 identity drift，停止新写入并保留当前 active records，不能通过把 preview 标成 official 或重建历史 checksum 来恢复。

## Open Questions

无。实现时只需根据现有 Prisma/schema 和 writer 图决定 DTO 文件位置；若发现某个旧记录没有安全 owner 或 revision，应标为不可合格的历史 observation，而不是猜测或补造身份。
