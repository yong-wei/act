# Proposal: issue-2152-p1 — 学生辨识工件与对照工件持久化契约（阶段 1）

- Issue: #2152（P1，父项 #2146；内核 #2148 已就绪——Nomoto1/2、FOPDT、
  RollOscillator、DP 3×3、挖泥通道辨识/预测全部合并）
- 类型: 学习证据记录类型 B/C 的持久化基建（多阶段；本 change 覆盖阶段 1）

## Why

#2152 要求学生辨识工件（StudentModelArtifact）与比较工件
（ComparisonArtifact）成为有版本、可追溯、绑定物理 run 的独立记录，
最终报告引用它们而非报告 HTML 自身。当前库中只有 VirtualSimulationReport
（成绩/报告正文）与 SimulationRun（运行信封），辨识产物只能停留在浏览器
内存——刷新即失，无法支撑「先冻结模型再看验证结果」「保留较差尝试」的
教学真实性要求。

## What Changes（阶段 2a：生效运行信封）

5. **Prisma 模型 `AppliedRunEnvelope`**：PhysicalRun 必存字段的生效态
   信封（experimentKey/stepKey/courseVersion/modelId/modelVersion/
   parameterBundleHash/environmentVersion/sensorVersion/seed+substreamIds/
   initialState/appliedFactorMask/controllerArtifactHash/simulationStart/
   End/terminationReason/quality + firstSampleReceipt 首采样回执哈希）；
   runRef 唯一、upsert 开启/收口语义。编辑态参数不等于生效配置——
   信封由首采样回执绑定实际运行。

## What Changes（阶段 1）

1. **Prisma 模型** `StudentModelArtifact` + `ComparisonArtifact`
   （附迁移）：版本链（userId+experimentKey+lineageKey+version 唯一）、
   只增不改（重新辨识=新行）、内容哈希、训练/验证 run 窗口引用。
2. **纯 zod 契约** `src/lib/student-model-artifact-contract/`：
   ModelStructure 判别联合（kind 标签与 Rust serde snake_case 逐字对齐，
   含 dp_low_freq3 的 9 元素矩阵）、比较模式枚举、保存载荷校验
   （非有限值拒绝、dt>0、窗口正时长、训练/验证窗口不重叠）。
   契约模块不引 node:crypto/Prisma（客户端可复用）。
3. **API** `/api/ilab/student-model-artifacts`（POST 保存/GET 列表）与
   `/api/ilab/student-model-artifacts/[id]`（GET 详情）、
   `/api/ilab/comparison-artifacts`（POST/GET）：会话鉴权、本人所有权、
   contentHash 由服务端以规范序计算（客户端不可自报）。
4. **Vitest 契约测试**：Rust serde 样例往返、非法载荷拒绝（NaN/未知
   kind/重叠窗口/跨用户引用）、规范化确定性。

## Impact

- 新增 DB 表两张（迁移 + prisma generate）。
- 不改动现有 VirtualSimulationReport / SimulationRun / 旧 24 步链路。
- 学生可见文案不暴露 canonicalId/内部标识（错误信息用通用中文）。

## Non-Goals（后续阶段）

- 20Hz 主通道采样分块与高频安全指标窗口（阶段 2b；信封先行）。
- 客户端运行时接线（随 per-vessel WASM 迁移接入，本阶段交付服务端契约）。
- Attempt/StepSubmission 与首/最近/最佳/选定尝试（阶段 3）。
- 最终报告六部分装配（阶段 4）；教师复核工作台（阶段 5）。
- 曲线高频分块存储与采样语义标注（阶段 2）。
- 删除或迁移旧 24 步记录（#2155 职责）。
