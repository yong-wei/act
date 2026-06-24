# audit-remediation-arena-classroom-evidence 整改证据

## 关联审计章节

- `chapters/15-function-state-flows-batch7.md`：学生真实 Arena 提交 0 分但表达为有效/入榜；教师报告把 0 分显示为优秀方案。
- `chapters/20-function-state-flows-batch12.md`：已截止 Arena 报告没有展示 late/逾期语义，0 分和逾期提交进入优秀方案。
- `chapters/32-function-state-flows-batch24.md`：课堂结束后学生缺少结束态和证据入口，教师结束课堂仍用原生 confirm，课堂证据存在重复风险。

## 已整改范围

- Arena 报告服务新增 `attemptPolicy`，区分有效尝试、迟交、零分、无效提交、多次提交学生，并以最佳有效尝试作为个人最佳和优秀方案候选依据。
- Arena 共享榜单、荣誉展示和学生提交反馈统一使用最佳有效尝试口径：必须通过硬约束、未迟交且得分大于 0 才进入正式排名、荣誉或优秀展示。
- 教师 Arena 发布报告新增“提交口径”区块，展示有效尝试、迟交、零分、多次提交计数，并解释 late、zero-score 和展示规则。
- 学生 Arena 挑战入口新增官方提交说明：只有通过硬约束且得分大于 0 的最佳有效尝试进入榜单；迟交、零分、无效提交保留为复盘证据。
- 课堂 join API 返回结构化 `joinState`，错误态包含恢复动作，成功态说明课堂状态、互动提交、教师复盘和学生证据页的分层路径。
- 课堂 state API 返回 `evidenceWriteback`，明确本接口只保存 `StudentState`；互动提交由 `/api/interactive/events` 写入 `InteractionLog`、`StudentStepResponse` 并实时物化 `LearningFact`，课堂结束后的 finalization 刷新教师复盘和学生证据页。
- `/api/interactive/events` 在写入 `InteractionLog`、`StudentStepResponse` 和 `LearningFact` 前，按 `userId/sessionId/lessonKey/stepId/cardId/submission identity` 对课堂提交做应用层串行去重；已存在同一身份的重复提交不会重复写入证据，也不会保留 raw `InteractionLog`。
- 学生课堂结束态新增“查看课堂证据”入口，链接到 `/profile/evidence?sessionId=...`。
- `/profile/evidence?sessionId=...` 已穿透到 `EvidenceTimelineBrowser` 并请求 `/api/student/evidence?sessionId=...`。
- 教师结束课堂改为页面内确认，说明证据生成和复盘影响；确认后进入 `/classroom/teacher/{sessionId}/review`。
- 教师运行态新增 `data-classroom-state-flow="join-release-submit-summary-end-review"` 状态条，覆盖加入、发放、提交、汇总、结束、课后复盘。

## 验证命令

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-publication-report.test.ts src/features/arena/__tests__/arena-official-submit-feedback.test.ts`
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-publication-report.test.ts src/features/arena/__tests__/arena-official-submit-feedback.test.ts src/features/interactive/__tests__/classroom-join-entry.test.ts src/features/interactive/__tests__/session-state-route-auth.test.ts src/lib/data-governance/__tests__/historical-evidence-materialization.test.ts`
- `rtk npm run test:unit -- src/app/api/interactive/events/__tests__/route.test.ts src/lib/data-governance/__tests__/evidence-browser-entrypoints.test.ts`
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-feedback-rules.test.ts src/features/arena/__tests__/arena-publication-report.test.ts src/features/interactive/__tests__/session-state-route-auth.test.ts src/app/api/interactive/events/__tests__/route.test.ts src/lib/data-governance/__tests__/evidence-browser-entrypoints.test.ts`
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-feedback-rules.test.ts src/features/arena/__tests__/arena-publication-report.test.ts src/features/arena/__tests__/arena-official-submit-feedback.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/interactive/__tests__/classroom-join-entry.test.ts src/features/interactive/__tests__/session-state-route-auth.test.ts src/lib/data-governance/__tests__/historical-evidence-materialization.test.ts src/app/api/interactive/events/__tests__/route.test.ts src/app/api/session/join/__tests__/route.test.ts src/lib/data-governance/__tests__/evidence-browser-entrypoints.test.ts src/lib/data-governance/__tests__/evidence-timeline.test.ts src/lib/data-governance/__tests__/student-evidence-route.test.ts`
- `rtk npx vitest run src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-feedback-rules.test.ts src/features/arena/__tests__/arena-publication-report.test.ts src/features/arena/__tests__/arena-official-submit-feedback.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/interactive/__tests__/classroom-join-entry.test.ts src/features/interactive/__tests__/session-state-route-auth.test.ts src/lib/data-governance/__tests__/historical-evidence-materialization.test.ts src/app/api/interactive/events/__tests__/route.test.ts src/app/api/session/join/__tests__/route.test.ts src/lib/data-governance/__tests__/evidence-browser-entrypoints.test.ts src/lib/data-governance/__tests__/evidence-timeline.test.ts src/lib/data-governance/__tests__/student-evidence-route.test.ts --reporter=json --outputFile=artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/remediation/audit-remediation-arena-classroom-evidence/api-checks-vitest-report.json`

## API Check Capture

- `api-checks-vitest-report.json`：JSON capture，覆盖 Arena leaderboard/honors/student feedback 有效排名口径、Arena evaluator 零分解释、Arena publication report late/zero/invalid 口径、课堂 state API `evidenceWriteback`、finished join API 不暴露 raw session id、互动事件 API 按提交身份去重、`/profile/evidence?sessionId=...` 到 `/api/student/evidence?sessionId=...` 的 URL 穿透。

## 未关闭范围

- 教师课堂复盘页的导出、发送、复制摘要、发布补强路径仍未在本变更内完成，继续保留为后续教师报告交付整改。
- Arena 报告标题仍使用任务 id 的问题未在本变更内关闭。
- 课堂提交去重当前为事件入口应用层检查，能覆盖串行重复和已存在同身份提交；并发 POST 的数据库级唯一约束或事务级幂等仍未在本变更内完成。
