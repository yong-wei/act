# Tasks: issue-2081-consume-nested-goal-evidence

## 1. 归属规则扩展

- [x] 1.1 在 `src/features/personalization/plugins/control-correction/evidence-match.ts` 的内存匹配中增加嵌套路径 `adaptiveAssessment.kaqQuizEvidence.learningGoalIds` 读取；包含控制校正目标即归属，顶层显式冲突目标拒绝。
- [x] 1.2 在 `buildExplicitControlCorrectionLearningFactWhere` 中增加 `contextJson` 路径 + `array_contains` 条件，与内存规则共用同一归属判定导出。
- [x] 1.3 确认治理合格性过滤顺序不变（先归属、后 `isLearningFactEligibleForPersonalization`）。

## 2. 回归测试

- [x] 2.1 内存匹配：嵌套目标事实归属控制校正切片；顶层冲突目标拒绝。
- [x] 2.2 where 构造：同一批事实 DB 查询与内存匹配结果一致。
- [x] 2.3 learner-state：合格嵌套事实进入后九个控制校正维度 evidenceCount 非零、能力目标 refs 非空。
- [x] 2.4 四条拒绝路径：无学习目标、无审核、版本不一致、目标不匹配均维持拒绝。

## 3. 验证

- [x] 3.1 `rtk npm run test:unit`（personalization 与 learner-state 相关文件）与 `rtk npm run typecheck` 通过。
- [x] 3.2 与进行中 change `guard-client-competency-contribution` 的邻域冲突检查（同触 quality-weight 邻域，必要时 rebase）。
- [x] 3.3 `openspec validate issue-2081-consume-nested-goal-evidence --type change --strict` 通过。
