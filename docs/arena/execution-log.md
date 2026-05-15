# Arena V2 执行记录

## 任务 01：基线核验与任务地图

**执行时间**: 2026-05-13 08:53 GMT+8
**当前分支**: `codex/arena-v2`
**Commit**: `80c57a1c` (docs: add arena v2 execution plan)
**工作区状态**: 干净（仅有 `docs/arenav2.md` 修改和 `docs/arena/` 未跟踪文件）

### Arena 模块清单

**核心领域** (`src/features/arena/`):
- `types.ts` — 对象、任务、指标、榜单策略、控制器工件等核心类型
- `data/seed-challenges.ts` — 典型白箱、作业、奥德赛、虚拟仿真、黑箱对象与任务种子
- `index.ts` — 统一导出
- `workspace-routing.ts` — 将任务路由到对应工作台URL（多表征/框图/黑箱辨识/预测控制/奥德赛）
- `filtering.ts` — 任务筛选
- `profile.ts` — 用户画像
- `telemetry.ts` — 埋点定义
- `arena-telemetry-client.tsx` — 埋点客户端

**评测** (`evaluation/`):
- `types.ts` — 评测结果、硬约束、罚分类型
- `evaluator.ts` — 评测入口分发
- `whitebox-evaluator.ts` — ⚠️ 使用 `estimateMetrics` 启发式估算（非真实控制分析）
- `blackbox-evaluator.ts` — 黑箱评测
- `scoring.ts` — 满意度归一化与加权几何平均

**提交** (`submissions/`):
- `persistence.ts` — `createPersistedArenaSubmission` 持久化链路
- `prisma-store.ts` — Prisma 存储实现（按 taskId + artifactHash + protocolVersion 缓存）
- `controller-artifact-builder.ts` — 从表单参数构建工件
- `blackbox-artifact-builder.ts` — 黑箱工件
- `submission-service.ts` — 提交服务
- `artifact-hash.ts` — 工件哈希
- `arena-submission-panel.tsx` — 提交面板UI

**黑箱** (`blackbox/`):
- `experiment-service.ts` — 实验服务（预算=20/天，事务控制）

**教师端** (`teacher/`):
- `configuration.ts` — 教师配置
- `teacher-arena-config.tsx` — 配置面板

**测试** (`__tests__/`): 12 个测试文件，96 个测试全部通过

**应用层** (`src/app/`):
- `src/app/arena/page.tsx` — 大厅页
- `src/app/arena/challenges/[taskId]/page.tsx` — 挑战详情页
- `src/app/api/arena/evaluate/route.ts` — 官方评测API（学生鉴权 → 持久化提交）
- `src/app/api/arena/blackbox-experiments/route.ts` — 黑箱实验API
- `src/app/api/arena/virtual-simulation-runs/route.ts` — 虚拟仿真预演API

### 第一个断点：多表征工作台不解析 arenaTask

`getArenaWorkspaceHref` 已将 arenaTask 拼入 URL：
```
/interactive-learning/multi-representation-linkage?arenaTask=task-second-order-lead-pid
```

但 `page.tsx:20-35` 的 `parseInitialParams` 只解析：
- `courseMode`
- `role`
- `embed`
- `controlMode`
- `kp`, `ki`, `kd`

**完全未解析 `arenaTask`**。且 `MultiRepresentationInitialParams` 接口中无 `arenaTaskId` 字段。

结果：从竞技场进入多表征工作台后，仍走默认邮轮模型或自由探索逻辑，挑战上下文丢失。

### Prisma 模型状态

5 个 Arena 模型均已定义：
- `ArenaControllerArtifact` (L1124)
- `ArenaEvaluationRun` (L1142)
- `ArenaSubmission` (L1165)
- `ArenaBlackBoxExperiment` (L1195)
- `ArenaVirtualSimulationRun` (L1211)

关系正确：Submission → ControllerArtifact (Cascade), Submission → EvaluationRun (Cascade)

### 白箱官方评测现状

当前白箱官方评测使用同步 heuristic template provider：
- `evaluateWhiteBoxSubmission` 通过 `selectWhiteBoxMetricProvider(method)` 获取指标 provider
- provider 内部包装 `estimateMetrics`，估算调节时间、超调量、稳态误差、控制能量等
- `template-whitebox-v1` 是当前启用协议；`analysis-whitebox-v1` 仅预留给后续服务端 `ControlAnalysisResult` 评测
- 满意度归一化和评分公式（`scoring.ts`）体系正确，可复用

### 基线测试结果

| 检查项 | 结果 |
|--------|------|
| `npm run test:unit -- src/features/arena` | ✅ 12 files, 96 tests passed |
| `npm run lint` | ✅ No ESLint warnings or errors |
| 工作区状态 | ✅ 干净 |

### 后续任务改动范围预估

**必改文件** (任务 02-05):
- `src/features/arena/types.ts` — 扩展 ChallengeObject
- `src/features/arena/index.ts` — 导出新模块
- `src/app/interactive-learning/multi-representation-linkage/page.tsx` — 解析 arenaTask
- `src/features/interactive/multi-representation-linkage/model.ts` — 消费 ArenaWorkbenchContext
- `src/features/interactive/multi-representation-linkage/page-client.tsx` — 上下文栏UI
- `src/resources/control-system/analysis/multi-representation-linkage-analysis.ts` — plant 注入

**新增文件** (任务 02-06):
- `src/features/arena/workbench/types.ts`
- `src/features/arena/workbench/context.ts`
- `src/features/arena/workbench/capabilities.ts`
- `src/features/arena/evaluation/protocol.ts`
- `src/features/arena/evaluation/control-analysis-adapter.ts`
- `src/features/arena/evaluation/metric-extraction.ts`
- `src/features/arena/evaluation/whitebox-metric-provider.ts`
- `src/features/arena/__tests__/workbench-context.test.ts`

### 已识别的阻塞风险

1. **Rust/WASM在服务端的可用性**: 白箱评测需要从 ControlAnalysisResult 提取指标，但WASM在 Node.js/Next.js API route 中的 bundling 可能有问题
2. **Prisma Client 与 schema 一致性**: 需 `npx prisma generate` 确认
3. **既有全量 build**: 未在基线阶段运行，后续阶段需确认

### 结论

Arena 绝非空白模块。现有代码已具备大厅、详情、提交、缓存、黑箱实验、评测器、榜单、埋点、教师配置和路由等完整骨架。第一个核心断点是 `arenaTask` 参数未从 URL 解析注入工作台。修复此断点即可让 Arena 与多表征工作台从"并列页面"变为"任务驱动工作台"。

---

## 任务 02：领域模型、能力矩阵与工作台上下文

**执行时间**: 2026-05-13 09:04 GMT+8
**状态**: ✅ 完成

### 改动摘要

**新增文件**:
- `src/features/arena/workbench/types.ts` — ArenaWorkbenchContext, ArenaWorkbenchPreviewSummary 类型
- `src/features/arena/workbench/capabilities.ts` — inferArenaObjectCapabilities 能力矩阵推断
- `src/features/arena/workbench/context.ts` — resolveArenaWorkbenchContext 上下文解析
- `src/features/arena/workbench/metric-mapping.ts` — 工作台预评测指标映射
- `src/features/arena/__tests__/workbench-context.test.ts` — 43 个新增测试

**修改文件**:
- `src/features/arena/types.ts` — 新增 ArenaModelCapabilities, 扩展 ChallengeObject (modelType, timeRange, frequencyRange, workbenchSeed)
- `src/features/arena/data/seed-challenges.ts` — 为 11 个对象补充 modelType, timeRange, frequencyRange, workbenchSeed
- `src/features/arena/index.ts` — 导出 workbench 模块

### Codex Review 修复

4 个 P2 问题已修复:
1. 复共轭极点对完整存储（二阶/奥德赛/船舶白箱）
2. workbenchSeed gain 标准化为 num_lead/den_lead
3. 白箱传函对象支持复合补偿能力
4. 预评测分数在指标缺失时返回 null 而非部分分数

### 验证结果

| 检查项 | 结果 |
|--------|------|
| Arena 单元测试 (13 files) | ✅ 129 tests passed |
| Lint | ✅ No warnings or errors |
| Build | ✅ Passes |
| Smoke tests | ✅ Passes |

### 关键决策

- `inferArenaObjectCapabilities` 集中维护能力矩阵，不在各页面重复判断
- `resolveArenaWorkbenchContext` 在 task/object/metricProfile/leaderboardPolicy 任一缺失时返回 null
- workbenchSeed 显式提供预计算 poles/zeros/gain，避免 UI 层多项式求根
- 非最小相位对象（gain 为负）使用 |gain|，zerore 位置正确编码 RHP 零点
