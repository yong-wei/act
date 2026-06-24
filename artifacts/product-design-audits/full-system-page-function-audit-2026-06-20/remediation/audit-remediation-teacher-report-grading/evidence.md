# audit-remediation-teacher-report-grading 整改证据

日期：2026-06-21

## 覆盖范围

本变更只关闭教师报告交付、评分工作台状态、教师学生证据 deep link 与移动长报告主动作区相关缺陷。学生报告反馈、任务大厅、作品集、管理员用户、治理导出、配置模型测试等缺陷不在本变更中关闭。

## 审计证据来源

- `chapters/51-function-state-flows-batch43.md`：教师课堂复盘、班级分析和报告账本有报告导出 API 或数据，但教师 UI 不承接交付动作。
- `chapters/55-function-state-flows-batch47.md`：教师历史、课堂复盘、班级分析缺少交付状态和补强入口。
- `chapters/56-function-state-flows-batch48.md`：评分工作台坏 `gradingRunId` 恢复路径跳首页；控制校正报告 API 可用但 UI 不承接交付。
- `chapters/63-function-state-flows-batch55.md` 至 `chapters/67-function-state-flows-batch59.md`：教师报告下载/发送、评分审批、学生证据 deep link 和移动长页固定动作区反复失败。

## 已落地整改

- `src/lib/teacher-report-grading-contracts.ts`
  - 定义教师报告交付查询合同，覆盖 `export`、`download`、`send`、`deliver`、`lock`、`summary` 和 `reinforcement`。
  - 将缺失学生交付映射为 `blocked` / `404`，将不支持动作映射为 `unsupported`，并把 `returnTo` 限定在 `/teacher` 范围内。
  - 定义评分工作台路由状态，覆盖缺失 `gradingRunId`、普通无效评分运行、不支持 GET、审批/写回缺少运行标识和草稿等待状态。
- `src/app/teacher/classes/[classId]/analytics-v2/page.tsx`
  - 在班级分析顶部增加教师报告交付工作区，显示报告版本、导出 JSON 和复制摘要。
  - 发送学生、锁定版本和补强任务不作为伪 CTA 展示；缺失学生和锁定动作以可恢复状态说明呈现。
  - 将现有 `/api/teacher/classes/[classId]/control-correction-report?export=true` 接入 UI 下载动作，生成 JSON 文件名并显示成功/失败状态。
  - 增加移动端底部固定交付动作区，长报告移动视口可在任意滚动位置执行导出与摘要复制；桌面端不常驻底栏。
  - 将 `action=download/export/send/lock` 等深链状态渲染为统一 `ActionStatusPanel`，缺失学生不再跳公开首页。
- `src/app/(teacher-report-ledger)/teacher/grading-workbench/page.tsx`
  - 解析 `gradingRunId`、`action`、`method`、`status`、`classId`、`studentId`、`assignment` 和 `returnTo`。
  - 在空态、demo 态和真实评分工作台中显示路由状态，坏 run、普通无效 run、GET 方法边界和草稿等待不再被泛空态吞掉。
- `src/features/assessment/document-rubric-grading-ui.tsx`
  - 在评分工作台页头和空态页头渲染统一动作状态面板。
- `src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx`
  - 独立显示 `gradingRunId`、`reportId` 和 `source` 上下文标签，并把这些参数安全合入返回链接。
  - 限制返回路径只能留在教师域。
- `src/app/(main)/teacher/students/[studentId]/evidence/page.tsx`
  - legacy 教师证据入口会将 `returnTo`、`gradingRunId`、`reportId` 和 `source` 透传到班级域证据页。
  - 学生不存在或无权限时留在教师域显示 `blocked` / `404` 状态，不再静默跳转到班级列表。

## 验证

- `rtk npm run test:unit -- src/lib/__tests__/teacher-report-grading-contracts.test.ts src/lib/__tests__/teacher-report-grading-ui-source.test.ts src/features/assessment/__tests__/document-rubric-grading-route-state.test.ts src/app/__tests__/action-status-panel.test.ts src/lib/data-governance/__tests__/evidence-browser-entrypoints.test.ts src/lib/__tests__/adaptive-learning-center-ui.test.ts`
  - 6 files / 73 tests passed。
- `rtk npm run lint`
  - passed。

## 整改标注

- `chapters/66-function-state-flows-batch58.md` 的 435、436、437 和教师交付相关的 442 已由本变更覆盖。
- `chapters/67-function-state-flows-batch59.md` 的教师报告移动固定动作、评分工作台缺失 run 和学生证据 deep link 上下文已由本变更覆盖。
- `chapters/51`、`55`、`56`、`63`、`64`、`65` 中与教师报告交付/评分上下文相关的重复证据已纳入同一整改范围。

## 未关闭项

- 学生报告反馈采用/写回、任务大厅 returnTo、作品集收录、管理员用户筛选/导出、治理分派/导出、配置模型测试仍需各自垂直变更关闭。
- 班级学生管理独立 `/teacher/classes/[classId]/students` 页面仍未在本变更中创建；报告交付动作回到已有班级页选择学生，避免引入未经验证的新路由。
