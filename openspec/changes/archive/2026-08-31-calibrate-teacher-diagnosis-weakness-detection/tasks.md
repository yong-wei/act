## 1. 确定性薄弱判定校准门禁

- [x] 1.1 在 `diagnosis-generation-provider.ts` 实现节点弱势统计与最小证据校验（`NOT_STARTED` 或 `progress < 40 且未完成` 为弱势行；班级阈值 `max(3, ceil(0.2 × 有进度记录学生数))`；学生诊断按目标学生单行判定），新增 `DiagnosisFindingCalibrationError`
- [x] 1.2 实现覆盖降级校验：知识点 finding 引用节点进度行覆盖 < 全体学生时，报告 `confidence` 不得为 `high` 且 `limitations` 非空
- [x] 1.3 在 `diagnosis-generation-worker.ts` 的 `classifyDiagnosisGenerationFailure` 接入校准门禁（`validation:false`、code `diagnosis-finding-calibration-invalid`，进入既有重试预算）
- [x] 1.4 单元测试覆盖：健康场景（无弱势节点，知识点 finding 被拒）、阈值边界（弱势行数恰为阈值 / 阈值-1）、单弱点、多弱点、COMPLETED 高进度正常节点禁判、学生诊断单行判定、覆盖不足降级

## 2. 提示词分层指令

- [x] 2.1 system prompt 增加薄弱判定分层指令：绝对弱势锚定、相对较低但正常禁判、空 findings 鼓励输出与"未发现明确薄弱节点"表述、证据冲突写 limitations 并降 confidence、数据缺失显式说明
- [x] 2.2 提示词快照测试更新，确认新指令与既有语言/归因/引用指令共存

## 3. 投影与展示确认

- [x] 3.1 核查空 findings 在历史投影、delivery 投影与 PDF 链路的展示无越界、无误导；必要时修正
- [x] 3.2 历史/交付投影相关测试补充空 findings 场景断言

## 4. 验证

- [x] 4.1 `npx vitest run src/lib/__tests__/diagnosis-generation.test.ts src/lib/__tests__/teacher-diagnosis-report-history-evidence.test.ts` 及新增校准测试全量通过
- [x] 4.2 `rtk npm run typecheck` 零错误；`rtk npm run lint` 不引入新错误
- [x] 4.3 冻结基准集真实模型复测由 #1729 评测门禁承接，不在本变更内重复实现
