# Proposal: issue-2033-oss

## Why

Issue #2033：比赛验收不能只证明"页面出现了三张候选卡片"。三条候选路径必须承担不同学习策略、由当前学生画像驱动、使用真实 OSS Runtime 教学资源，且差异可量化、可复现、可解释。#1983/#1984/#1985 已交付三候选数量合同、画像 fence 与资源偏好层，但缺少：策略语义与画像的显式绑定、两两量化区分度门禁、OSS 对象键来源与真实读取验证、以及单变量对照验收。

## What Changes

- **三策略语义绑定**：将现有三族策略（foundation-remediation / preference-matched / simulation-driven）显式承载三种学习策略——薄弱点补强（画像缺口驱动节点与资源选择）、偏好资源强化（画像资源偏好驱动类型占比）、优势迁移应用（画像优势能力驱动综合/仿真任务）；每条候选携带策略名、画像依据（哪些画像事实、证据状态）与资源构成说明，不再使用泛化文案。
- **量化区分度门禁**：服务端在候选批次装配时计算两两比较指标（核心节点集合 Jaccard、核心 OSS 对象键集合 Jaccard、资源类型分布总变差、共有节点顺序差异、时长差、检查点结构性差异、不同核心节点数），持久化进候选批次并在响应中返回；"高区分度个性化推荐成功"标记必须 7 项中至少 3 项达标，未达标不得复制路径凑数。
- **OSS 来源与读取验证**：路径资源解析到 Runtime asset 对象键（`/api/course-runtime/assets/<assetPath>` 视图内对象键）；批次定稿时经 runtime 存储验证存在性与内容校验值，产出读取验证记录（Runtime release、资源 ID、对象键、校验值、候选路径/节点 ID、时间、结果）；验证失败的资源不计入覆盖与区分度、不静默替换，页面展示具体失败原因；资源不足时如实返回"资源不足"限制。
- **单变量对照可复现**：画像受控 fixture（薄弱点/优势/资源偏好/资源池）+ 确定性规划输入，支撑薄弱点切换、偏好切换、优势切换三组单变量对照测试与资源不足故障注入测试。
- **比较呈现**：候选比较区并列呈现策略、画像依据与证据状态、核心节点与顺序、OSS 核心资源及类型占比、Runtime 来源与读取状态、时长、检查点安排、两两量化差异摘要；刷新与重排不漂移（结论来自服务端持久化批次）。

## Capabilities

### Modified Capabilities

- `adaptive-learning-path-planning`：候选批次量化区分度门禁、三策略画像驱动装配、OSS 来源与读取验证、单变量对照可复现性。

## Impact

- `src/features/personalization/path-planning/internal/assemble-plan.ts`（策略语义与画像驱动排序）、`adaptive-path-candidate-batches.ts`（指标计算与持久化）、新 `adaptive-path-differentiation.ts`（纯函数指标）、`resource-ranker.ts`（策略加权）。
- `src/lib/konling-agent-runtime.ts` / `src/lib/resource-node-registry.ts`（资源→Runtime 对象键解析、读取验证挂点）。
- `src/app/assessment/adaptive-practice/page.tsx` 与候选比较展示（差异摘要与读取状态）。
- 验收脚本与 fixture（受控画像、单变量对照、故障注入、证据包产出）。

## 非目标

- 不建立"最佳路径"排名；不引入强化学习或 contextual bandit；不新增个人中心画像字段；不把路径选择或页面浏览作为掌握度证据；不修改历史候选批次和已执行路径。
