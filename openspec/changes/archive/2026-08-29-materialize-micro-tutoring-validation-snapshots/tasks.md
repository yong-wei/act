## 1. 同步合同

- [x] 1.1 从 v2 验证注册表派生 AdaptiveAssessmentItemRef 物化计划：唯一 sourceId、内容哈希、catalog 快照、itemRevision 与捕获修订。用规划函数单测覆盖创建计划。
- [x] 1.2 对缺失 catalog、内容哈希漂移、版本漂移、learnerVisible 撤销、身份冲突和不洁净 Git 返回稳定失败。用规划函数单测覆盖这些缺口码。

## 2. 数据库应用

- [x] 2.1 按 (questionId, algorithmVersion, contentHash) 幂等创建快照；一致记录 unchanged，不得改历史主键或哈希。用 apply/幂等单测验证。
- [x] 2.2 把验证题快照同步纳入现有微辅导 CLI；TeachingResource 与验证题任一侧失败则整体失败。用脚本契约或集成测试证明入口会应用两类计划。

## 3. 编排与学生可见路径

- [x] 3.1 保持现有编排查询与 parseValidationItem fail-closed，不放宽条件。用复现题证明物化后不再返回 VALIDATION_QUESTION_UNAVAILABLE。
- [x] 3.2 将 VALIDATION_QUESTION_UNAVAILABLE 映射为明确学生中文提示。用学生面板回归测试覆盖该文案。

## 4. 验证与交付

- [x] 4.1 覆盖 54 道 practice 已审核错误选项：同步后的资源+验证题快照能形成 5–10 分钟任务；frequency-response-foundations-practice-06 已审核错误选项同样不再 VALIDATION_QUESTION_UNAVAILABLE。
- [x] 4.2 运行相关测试、typecheck 与 `openspec validate --strict`，归档后提交关联 #1687 的 PR。
