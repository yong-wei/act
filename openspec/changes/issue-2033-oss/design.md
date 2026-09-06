# Design: issue-2033-oss

## 现状锚点（2026-09-06 勘察）

- 三候选由 `buildPolicyBundle`（assemble-plan.ts:5045）按 `starterPathPolicy.policyFamilies`（foundation-remediation / simulation-driven / preference-matched）生成，候选带 `styleId` 与指纹，批次经 `adaptive-path-candidate-batches.ts` 持久化（Prisma `adaptivePathCandidateBatch`），已有 diversity limitations（`policy-option-diversity-unavailable`、`insufficient-distinct-resources`）。
- 画像已进入规划器（`learnerState.primaryPortraitState`、`resourcePreference`、competency vector；#1984 fence、#1985 偏好层）；`resource-ranker` 已有类型偏好与缺口加权。
- 资源节点带 `launchTarget`/`renderTarget` URL；Runtime 资产以 `/api/course-runtime/assets/<assetPath>` 提供（OSS blob-view 内 assetPath 即对象键），`blob-assets/[sha256]` 路由存在内容寻址读取。
- 比较授权机制在 `adaptive-path-comparison.ts`（pair 枚举、版本键）。

## 决策

1. **策略承载复用三族，不改族名**。族→策略映射为常量（foundation-remediation→薄弱点补强、preference-matched→偏好资源强化、simulation-driven→优势迁移应用），策略语义落在各族的节点装配差异化：
   - 薄弱点补强：缺口目标加权排序提前 + 缺口相关资源筛选配额（deficit→registry 资源的 knowledgeNodeIds 关联已存在）；
   - 偏好资源强化：`preferredResourceTypes` 类型占比配额（排序加权已存在，补配额约束保证 ≥60% 可观察）；
   - 优势迁移：优势能力维度匹配的 simulation/arena/comprehensive 任务优先（competency vector→资源 abilityImpact 关联已存在）。
   - 每条候选在 plan explanations 增补 `strategy`（名+画像依据+证据状态），画像不可用时候选标记 `generic`，页面展示受限说明（不伪造薄弱点）。
2. **指标为纯函数新模块** `adaptive-path-differentiation.ts`：输入两条候选路径（核心节点、对象键集合、类型分布、顺序、时长、检查点）输出 7 项指标；批次装配处两两计算并随批次持久化；`highDifferentiation` 标记要求 ≥3 项达标（阈值按 issue：Jaccard≥0.40、TVD≥0.30、顺序≥0.30、时长≥20%、结构差异布尔、≥2 核心节点不同）。统一先修/终结验证节点由 stage-repair 标记排除。
3. **对象键解析与读取验证**：新增 resolver 从资源 URL 提取 `/api/course-runtime/assets/` 前缀的 assetPath 作为对象键（非 runtime 资产如实标记 `non-runtime` 不计入 OSS 指标）；批次定稿时经 runtime release store 做存在性+校验值验证并产出读取验证记录数组（进入批次持久化与响应）；验证失败资源从覆盖/区分度统计剔除并在候选 limitations 与页面展示；可计入资源不足以支撑三条时返回真实限制（不凑数）。
4. **对照可复现**：验收 fixture 提供受控画像（薄弱点/优势/偏好/资源池）与确定性输入；单变量切换 = 仅改画像字段重跑装配；随机性来源显式注入。故障注入 = fixture 中标记一个核心对象键损坏。
5. **呈现**：候选比较区数据全部来自服务端持久化批次（刷新/重排零漂移）；新增字段经既有 student-safe 投影路径（沿用 #2024 的投影保留教训，新增字段须过 `toStudent*` 三处投影审计）。

## Risks / Trade-offs

- force 布局与 force-graph 无关；规划器已确定性（同输入同输出），风险在资源池规模不足导致指标天然不达标——如实返回限制即可。
- 读取验证在批次定稿时同步执行，资源多时增加延迟；按候选核心资源（每路径 ≥3）限量验证。
- 旧批次无指标字段——读取时按缺省处理，不回填（非目标：不改历史批次）。

## Migration Plan

指标模块先行（纯函数+单测）→ 策略语义与装配 → 批次持久化与门禁 → 对象键解析与读取验证 → 页面呈现 → 验收脚本与证据包。每步带回归；最终在本地以受控画像跑验收脚本产出证据包。
