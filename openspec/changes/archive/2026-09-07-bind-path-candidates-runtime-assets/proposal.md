## Why

Issue #2055 实测：同一学生画像下生成了 3 条候选路径，但所有路径的 OSS/runtime 资源数量为 0、`objectKeyReadRecords` 为空，候选资源仍是站内页面路由。调查（基于 4ede7af2d）确认三重断裂：

1. **target 形态断裂**：#2033 交付的 `resolveAdaptivePathRuntimeObjectKey` 只识别 `/api/course-runtime/assets/*` 与 `/api/course-runtime/blob-assets/*` 形态的节点 target，但生产中四个候选源（DB TeachingResource、运行态课次目录、运行态教材结构、`runtime-resource-projections.jsonl` sidecar）产出的节点 target 全部是学生可导航站内路由；asset 形态 target 在全仓库仅存在于测试夹具（`scripts/tests/adaptive-path-differentiation-evidence.ts`、`adaptive-path-candidate-batches.test.ts`），读取验证机制在生产环境永不触发。sidecar 6882 行中 6880 行 `routeTarget` 为空，进一步证明现有候选源不产生 runtime asset 目标。
2. **destination contract 禁入**：`isStudentVisiblePathTarget` 明确拒绝任何含 `api` 段的 target，`resolveAdaptivePathDestinationContract` 也没有 runtime asset 处置——即使把节点 target 改写为 runtime asset URL 也会被门禁阻断并破坏导航。这证明 runtime 绑定必须独立于导航 target 存在。
3. **release 缺位静默**：`verifyCandidateObjectKeyReadRecords` 在无活动 runtime release（本地开发默认无 `.act-runtime-release.v1/v2.json` 与 active receipt）或异常时静默返回空数组，违反 #2033 与 #2055 共同的"不得静默退回"约定，使"0 资源"与"验证不可用"无法区分。

B′′（proj-a0ac654d，3129 资源 / 13584 绑定）已携带 `content:<sha256>` / `authoring:...` 形态 sourcePath，学习内容清单 v2 已纳入发布链闭包校验，但没有任何环节把候选节点连接到活动 runtime release 真实持有的对象键。

## What Changes

- 候选路径节点新增显式 runtime 资源绑定（对象键/blob 内容键、runtime release 标识、资源 ID、资源类型）：以教学投影确定性身份规则（`src/lib/teaching-projection/identity.ts`）把 ResourceNode 反解到 B′′ resourceId，经其 `sourcePath` 得到 blob 内容键或资产路径，再与活动 runtime release manifest 连接确认可用性；release manifest 是"可绑定"的唯一真源，禁止模糊匹配。
- #2033 读取验证改造为消费节点绑定字段；`resolveAdaptivePathRuntimeObjectKey` 的 target 字符串反解路径退役（生产不可达形态），既有夹具测试迁移到绑定构造。
- 绑定失败显式化：逐节点记录 `bound` / `no-runtime-identity` / `not-in-active-release` / `no-active-release` 状态与原因并随批次持久化；批次内无可用 OSS 资源时标记受限并说明原因，禁止静默空记录。
- 候选池诊断按资源族追加"可绑定 OSS 资源"计数（连接活动 release 后的真实可用数），回答"池里有多少可用 OSS 资源"。
- 候选比较投影呈现逐节点 runtime 来源、绑定/读取状态与失败原因；学生 API 维持 #2033 安全约束，不下发原始对象键。
- 节点导航 target 保持学生可导航站内路由不变（destination contract 不动）；runtime 绑定供目标页面经 runtime 网关实际加载资产，也为统一查看器（`universal-resource-launch-and-viewer`）提供直接打开依据。

## Capabilities

### Modified Capabilities

- `adaptive-learning-path-planning`：候选资源 runtime 来源与读取验证改为节点绑定驱动；新增节点绑定合同（独立于导航 target）、绑定失败显式记录、候选池可绑定计数要求。

## Impact

- 绑定解析与验证：`src/lib/konling-agent-runtime.ts`（`verifyCandidateObjectKeyReadRecords` 改造、批次元数据）、`src/features/personalization/path-planning/adaptive-path-oss-provenance.ts`（绑定解析替代 target 反解）。
- 绑定流入：`src/features/personalization/path-planning/internal/assemble-plan.ts`（节点绑定字段）、`src/lib/resource-node-registry.ts` 与候选池诊断（按族可绑定计数）。
- 呈现：`src/features/personalization/path-planning/adaptive-path-batch-comparison-view.ts`（逐节点绑定状态、读取状态与失败原因）。
- 只读输入：B′′ `resources.jsonl`（`course-content/runtime/knowledge/projection/releases/proj-a0ac654d*/`）、活动 runtime release manifest、cutover `denominator.json` 桥。
- 协调：与 `path-planning-consumes-teaching-projection`（#2046）共享身份映射与装配文件——#2046 负责候选池纳管全资源类型，本变更负责入选节点绑定真实 OSS 对象键，语义正交，按合并顺序处理文件级冲突；与 `explain-active-path-node-decisions` 的解释面边界不变。
- 不执行生产发布或运行态切换。
