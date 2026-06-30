# audit-remediation-teacher-evidence-intervention-closure 整改证据

日期：2026-06-30

## 覆盖范围

本变更关闭教师报告、评分工作台、教师学生证据页和学生反馈目标页之间的处置记录与状态语义缺口。它复用 `EvidenceOutbox` 和既有 `LearningPathIntervention` 作为持久化载体，不新增第二套证据模型，也不声明缺少学习路径时已经完成个性化补练写回。

## 审计证据来源

- `chapters/59-function-state-flows-batch51.md`：350、351、352、353 指出教师报告、学生画像推荐、学生证据审核和评分工作台无法形成补强或写回闭环。
- `chapters/62-function-state-flows-batch54.md`：388、389 指出 report-ledger 与评分工作台仍缺少报告账本、评分关联和异常恢复。
- `chapters/66-function-state-flows-batch58.md`：435、436、437、442 的前序整改已解决报告导出、缺失学生和评分方法边界，但仍留下教师处置到学生侧可见结果的闭环。
- `chapters/67-function-state-flows-batch59.md`：445、446、447、451 的前序整改已解决报告移动动作、评分状态和证据 deep link，上下文处置结果仍需统一合同表达。

## 已落地整改

- `src/lib/teacher-evidence-intervention-contract.ts`
  - 定义 `feedback`、`grading-writeback`、`reinforcement-task`、`remedial-path` 四类教师处置动作。
  - 动作记录包含教师、学生、班级、课堂、报告、评分运行、来源证据、状态、幂等键、学生侧目标和恢复动作。
  - 有可用补练 path 时指向既有 `LearningPathIntervention`；其他支持动作写入 `EvidenceOutbox`；缺少学生或证据时返回 `blocked`，缺少学习路径或学习者状态时返回 `reduced-personalization`。
  - `pending` / `recorded` / `reduced-personalization` 不生成 `status=completed` 学生链接；只有 `student-visible` 才生成学生侧可见目标。
- `src/app/api/teacher/evidence-interventions/route.ts`
  - 教师或管理员通过 POST 显式创建处置记录。
  - 非路径类处置写入 `EvidenceOutbox`，路径类处置在有效 `pathId` 下复用 `recordPathIntervention`。
  - POST 会校验班级、学生和学习路径归属；非当前教师班级、非目标班学生或无学生目标的班级级动作不会创建学生证据记录。
  - 学生或未授权用户不能创建教师处置；缺少 path 时写入 reduced-personalization 记录，不伪造完成状态。
- `src/lib/teacher-report-grading-contracts.ts`
  - 每个报告交付账本项都生成 pending `interventionAction`，报告、评分和补强交接不再只是一段不可追踪说明。
- `src/app/teacher/classes/[classId]/analytics-v2/page.tsx`
  - 报告交付 handoff 区输出 `data-teacher-intervention-action-id`、`status` 和 `persistenceTarget`，并显示隐私安全处置摘要。
  - “创建处置记录”按钮显式调用 `/api/teacher/evidence-interventions`；成功后显示记录已创建、等待学生侧写回。
- `src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx`
  - 教师学生证据页根据完整报告/评分上下文生成同一 intervention action。
  - 缺少上下文时保留证据和恢复动作，明确不伪造已完成写回。
- `src/lib/student-feedback-task-contract.ts` 与 `src/features/assessment/student-feedback-task-panel.tsx`
  - 学生反馈任务接收并持续携带 `teacherInterventionId`。
  - 只有携带 `teacherInterventionId` 且 `status=teacher-visible` 或 `written-back` 时显示教师处置已对学生可见；pending/blocked 状态不声明完成。

## 验证

- `rtk npm run test:unit -- src/app/api/teacher/evidence-interventions/__tests__/route.test.ts src/lib/__tests__/teacher-evidence-intervention-contract.test.ts src/lib/__tests__/teacher-report-grading-contracts.test.ts src/lib/__tests__/student-feedback-task-contract.test.ts src/lib/__tests__/teacher-report-grading-ui-source.test.ts src/lib/__tests__/student-feedback-task-ui-source.test.ts`
  - 6 files / 45 tests passed。
- `rtk npx eslint --max-warnings=0 ...`
  - 针对本变更触及的 contract、UI、学生入口和 API 文件通过。
- `browser-evidence.json`
  - 记录共享状态组件的 server-rendered DOM 片段，包含 `data-audited-action-id`、`data-audited-action-status`、`role=status` 和 `aria-live=polite`。

## 整改标注

- 350、351、352、353：由统一 intervention contract、教师报告 handoff、教师学生证据页处置状态和评分上下文恢复共同关闭处置记录缺口；学生通知和补练路径在缺少真实 path 时显示降级或 blocked，不伪造完成。
- 388、389：报告账本和评分状态现在通过同一处置记录连接来源证据、恢复动作和学生侧写回目标。
- 445、446、447：前序 UI 状态已存在，本变更补齐处置 action id、幂等键、持久 outbox 记录、学生侧目标和来源证据。
- 442、451 的教师处置部分：相关表面使用 status/live 面板和结构化 `data-*` 标记；管理员与统计导出仍归属其他变更。

## 未关闭项

- 真实创建新的学习路径仍依赖既有学习路径生成/选择流程；当 `pathId` 缺失时，本变更只提供持久 reduced-personalization 记录和恢复动作。
- 管理员治理、配置测试、统计导出、Arena 和作者态 finding 不在本变更范围内。
