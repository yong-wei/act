# #619 Student feedback learning-loop remediation evidence

整改变更：`audit-remediation-student-learning-closure`

关联审计章节：
- `chapters/55-function-state-flows-batch47.md`
- `chapters/56-function-state-flows-batch48.md`
- `chapters/63-function-state-flows-batch55.md`
- `chapters/64-function-state-flows-batch56.md`
- `chapters/65-function-state-flows-batch57.md`
- `chapters/66-function-state-flows-batch58.md`
- `chapters/67-function-state-flows-batch59.md`

## 覆盖范围

- 新增统一学生反馈任务上下文：`assignment`、`criterion`、`source`、`status`、`action`、`intent`、`returnTo`。
- 报告反馈页、自适应练习、任务大厅、互动资源、证据、成长和作品集页面共用 `StudentFeedbackTaskPanel`。
- 学习证据补充 `/api/learning-evidence`，并返回同一 assignment 上下文、写回目标、证据页数据和空态。
- 作品集 `intent=collect` 生成候选草稿，不直接声明已保存。
- 任务大厅 API 在反馈任务查询下按显式 assignment→mission order 映射收敛结果，并保留普通任务统计逻辑。
- 任务启动、仿真页、自适应路径跳转和资源完成会保留反馈上下文；完成动作回到报告反馈并进入 completed/待写回状态。
- `action=writeback` 不直接声明成功；只有 `status=written-back` 或 `status=teacher-visible` 才显示写回成功。

## 验收入口

- `/assessment/document-feedback?demo=1&assignment=report-control-design&criterion=model-assumptions&status=returned&action=adopt&source=batch59&returnTo=/assessment/document-feedback`
- `/assessment/adaptive-practice?assignment=report-control-design&criterion=model-assumptions&intent=document-feedback&status=completed&returnTo=/assessment/document-feedback`
- `/missions?q=report-control-design&status=completed&returnTo=/assessment/document-feedback`
- `/interactive-learning/resources/lesson09-correction-precheck?assignment=report-control-design&criterion=model-assumptions&status=completed&returnTo=/assessment/document-feedback`
- `/profile/evidence?assignment=report-control-design&criterion=model-assumptions&status=completed&source=batch59&returnTo=/assessment/document-feedback`
- `/profile/growth?assignment=report-control-design&criterion=model-assumptions&status=completed&returnTo=/assessment/document-feedback`
- `/profile/portfolio?category=reflection&assignment=report-control-design&criterion=model-assumptions&intent=collect&status=completed&returnTo=/assessment/document-feedback`
- `/api/learning-evidence?assignment=report-control-design&criterion=model-assumptions&status=completed`
- `/api/missions?assignment=report-control-design&status=completed&returnTo=/assessment/document-feedback`

## 本地验证

- `rtk npm run test:unit -- src/lib/__tests__/student-feedback-task-contract.test.ts src/lib/__tests__/student-feedback-task-ui-source.test.ts`
