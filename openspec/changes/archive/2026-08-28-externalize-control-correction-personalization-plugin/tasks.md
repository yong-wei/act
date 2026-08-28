## 1. Characterization and dependency gate

- [x] 1.1 验证 `reduce-personalization-learner-state` 与 charter/dependency contracts 已 qualified/strict-valid，并冻结 control-correction 现有 goal-slice、课程/lesson/Arena 映射、证据来源和持久化行为。
- [x] 1.2 盘点 `CONTROL_CORRECTION_COURSE_ID_VALUES`、Arena task IDs、goal dimensions、`ADAPTIVE_GOAL_SLICE_REGISTRY`、planner goal definitions、Konling/Arena/lesson consumers 和相关 worker/测试。
- [x] 1.3 为已知映射、未知/冲突映射、plugin 缺失、privacy/confidence、evidence lineage 和历史 revision 建立 characterization/parity fixtures。

## 2. Plugin contract and migration

- [x] 2.1 定义 versioned `PersonalizationGoalPlugin`/registry、context resolver、dimension/evidence/privacy/confidence contract 和 read/write ports；registry 不得直接依赖 Prisma 或客户端 payload。
- [x] 2.2 将 control-correction 的课程、lesson、Arena task、维度和 evidence/persistence strategy 迁入一个 plugin，保留现有输出和 authority owner，不创建第二个 registry。
- [x] 2.3 将 plugin persistence/evidence adapters 接入 Learning Record/Assessment read/write ports，确保 subject scope、idempotency、source coverage、confidence 和 immutable revision。
- [x] 2.4 迁移 learner-state、path/advisor、recommendation、Konling、Arena/lesson 和 worker 调用者到 plugin public contract；未知或停用 plugin 返回 unsupported/limited。

## 3. Delete hard-coded ownership and ledger

- [x] 3.1 删除通用 service/planner/recommendation 中的课程/lesson/Arena 常量、重复 goal registry authority 和只为旧入口存在的 re-export；具体 ID 只留在 plugin。
- [x] 3.2 更新 deprecation ledger、plugin registry manifest 和 dependency owner records，记录旧常量、消费者、替代 plugin、删除 revision 和验证证据。
- [x] 3.3 证明 plugin context、推荐叙述或课程映射不会单独授予 mastery、readiness、terminal validation、official Arena success 或教师权限。

## 4. Targeted and domain verification

- [x] 4.1 增加 registry uniqueness/version、mapping parity、unknown/conflict/retired plugin、port-only persistence、idempotency、privacy/confidence 和 no-authority tests。
- [x] 4.2 运行 Personalization、Learning Record、Assessment、path、Arena/Konling/lesson 相关测试与 `rtk npm run typecheck`，并单列既有失败。
- [x] 4.3 运行架构检查，确认 generic Personalization/learner-state/planner 不再导入 control-correction concrete IDs，也不存在第二个 registry。
- [x] 4.4 运行 `rtk openspec validate externalize-control-correction-personalization-plugin --type change --strict` 与 `git diff --check`；不执行部署或生产激活。
