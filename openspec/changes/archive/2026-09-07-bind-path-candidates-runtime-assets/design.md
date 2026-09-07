## Context

生产链路：控灵 `generate_learning_path` / `revise_learning_path_options` → `runAdaptivePathToolOperation` → `planLearningPath` → `buildAdaptivePathToolOutput`，批次定稿时调用 `verifyCandidateObjectKeyReadRecords(persistedPlan)`（`src/lib/konling-agent-runtime.ts`），记录随候选批次持久化并经 `adaptive-path-batch-comparison-view.ts` 投影。

当前验证解析器 `resolveAdaptivePathRuntimeObjectKey`（`src/features/personalization/path-planning/adaptive-path-oss-provenance.ts`）只认两种 target 形态：`/api/course-runtime/assets/<assetPath>`（对象键）与 `/api/course-runtime/blob-assets/<sha256>`（blob 内容键），其余一律 `non-runtime` 跳过。而 plan 节点 target 由 `resolveAdaptivePathDestinationContract`（`assemble-plan.ts:3350`，输入 `node.launchTarget ?? node.renderTarget`）产出，全部为学生可导航站内路由；`isStudentVisiblePathTarget` 还明确拒绝含 `api` 段的 target。因此生产上每个节点都是 `non-runtime`，`objectKeyReadRecords` 恒为空——这正是 #2055 的观测。sidecar `runtime-resource-projections.jsonl` 6882 行中 6880 行 `routeTarget` 为空，佐证现有候选源不产生 runtime asset 目标。

B′′（proj-a0ac654d）资源 `sourcePath` 形态已核实：`video`/`handout`/`card`/`exercise` 多为 `content:<sha256>`（blob 内容键），`audio` 可见 `authoring:lessons/<课次>/media/processed/...`（作者态路径），`simulation` 可为 `null`（身份型资源）。活动 runtime release manifest（`.act-runtime-release.v1.json` / `.act-runtime-release.v2.json`，`src/lib/runtime-active-release.ts`）携带 `files: [{path, sha256}]`；本工作树开发态两者均不存在（亦无 active receipt），`verifyCandidateObjectKeyReadRecords` 在此环境静默返回空。

## Goals / Non-Goals

**Goals:**

- 入选候选节点在批次定稿时携带显式 runtime 资源绑定，绑定对象键来自活动 runtime release manifest 真实持有的键集合。
- `objectKeyReadRecords` 消费绑定字段产出 `verified` / `missing` / `forbidden` / `checksum-mismatch` 记录；绑定不可解析的节点按状态与原因显式记录，不再静默跳过。
- 候选池诊断与候选比较投影能回答：池内有多少可用 OSS 资源、每个节点是否绑定、未绑定原因。
- 现有路径测试不回退；typecheck 通过。

**Non-Goals:**

- 不改节点导航 target 与 destination contract；不改学生面 sanitizer 与对象键下发边界。
- 不扩大候选池资源类型覆盖（属 `path-planning-consumes-teaching-projection`）；不做投影数据修复（属已归档 #2042）；不执行生产发布或运行态切换。
- 定稿期不新增字节级资源下载；`verified` 语义维持 manifest 命中 + sha256 一致（#2033 评审结论）；学生实际打开资源时的网关字节级服务由 runtime 网关承担。

## Decisions

1. **绑定字段独立于导航 target。** plan 节点新增 runtime 资源绑定字段并随批次持久化；导航 target 保持现有学生可见路由。备选是把 target 改写为 `/api/course-runtime/*`；拒绝——destination contract 会阻断该形态（`isStudentVisiblePathTarget` 禁 `api` 段），且破坏既有导航与毕业检查点语义。
2. **绑定解析 = 确定性身份映射 × 活动 release 连接。** ResourceNode id 经 `src/lib/teaching-projection/identity.ts` 既有派生规则反解为 B′′ `act:*` resourceId（与 `path-planning-consumes-teaching-projection` 共用同一映射函数，禁止两套映射）；B′′ `resources.jsonl` 取 `sourcePath`：`content:<sha256>` 直接作为 blob 内容键；`authoring:` 路径经课次媒体资产映射表转为 release 资产路径（无条目跳过并计数）；`sourcePath` 为 `null`（如 arena 仿真）按资源类型走既有 arena 目标完整性规则，仍无 runtime 身份的记 `no-runtime-identity`。活动 release manifest 是唯一可用性真源：键不在 manifest 记 `not-in-active-release`；无活动 release 记 `no-active-release`。
3. **验证器消费绑定字段，target 反解退役。** `verifyCandidateObjectKeyReadRecords` 遍历批次全部节点读取绑定字段并产出记录；`resolveAdaptivePathRuntimeObjectKey` 的字符串反解删除（生产不可达形态）；既有夹具测试迁移为构造绑定字段。验证深度维持 manifest 命中 + sha256。
4. **失败显式化（fail-loud）。** 消除三个静默点：无活动 release → 全节点 `no-active-release` 而非返回空；绑定不可解析 → 逐节点状态与原因；验证异常 → 记录错误原因并把批次标记受限。批次内无任何可用绑定（`verified` 计数为 0）时标记 `limited` 并在比较投影说明原因，禁止以空记录冒充"无 OSS 资源"。
5. **池统计与呈现。** `buildResourceCandidatePoolDiagnostics` 按族追加 runtime-bindable 计数（连接活动 release 后的可用数）；比较投影在既有"Runtime 读取状态"基础上呈现逐节点绑定状态与失败原因；学生 API 维持 `stripInternalBatchMetadata` 剥离原始对象键。

## Risks / Trade-offs

- [B′′ 与活动 release 版本错位导致大面积 `not-in-active-release`] → 绑定记录同时携带 B′′ 投影标识与 release 标识供诊断；漂移时如实记录，不伪造 `bound`。
- [`authoring:` 路径映射表与 release 实际资产路径不符] → 实现期以真实 release manifest 校验映射表；无映射条目跳过并按族计数，禁止猜测。
- [与 #2046 同文件改动冲突] → 两处改动集中在 `resolveAdaptivePathGenerationRegistry` / `assemble-plan.ts`，但 #2046 不改绑定、本变更不改候选准入，语义正交；按合并顺序重放冲突。
- [开发态无活动 release 导致端到端验证困难] → 验收以物化本地 release（既有 runtime release 工具链）为前提；无 release 环境的显式 `no-active-release` 记录本身就是验收点。

## Migration Plan

1. 绑定解析器落地（身份反解、sourcePath 解析、release 连接），单测覆盖三种失败状态。
2. 装配流入绑定字段 + 候选池按族可绑定计数。
3. 验证器改造 + 批次元数据失败记录 + 比较投影呈现。
4. 端到端：物化本地 release 后以 control-correction 目标生成候选，断言 OSS 资源数非零、记录含 releaseId/对象键/校验状态；故障注入（无 release、release 缺键）断言显式原因。
5. 回归：路径测试不回退；typecheck；openspec validate strict。
6. 回滚：移除绑定写入与验证器改造即恢复现状，无数据迁移。

## Open Questions

- `authoring:` 前缀 sourcePath 到 release 资产路径的映射以哪个既有桥（如 `build-active-runtime-media-source-bridge`）为准，实现期核对真实 manifest。
- simulation/arena-task 类节点是否以 `simulations/` 资产路径纳入绑定，取决于活动 release 是否持有对应资产，实现期以 manifest 为准。
- 定稿期是否对 `verified` 键追加网关 HEAD 探测以强化"实际可读"证据（#2033 评审曾放宽为 manifest 命中）；默认不追加，验收若要求再评估。
