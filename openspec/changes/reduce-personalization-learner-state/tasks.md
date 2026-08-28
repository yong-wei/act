## 1. Characterization and dependency gate

- [x] 1.1 验证 `cutover-path-owned-assessment-attempts`、charter 和 dependency-contract identities 已 qualified/strict-valid，并冻结 Assessment read projection 与 Learning Record evidence 分母。
- [x] 1.2 盘点 `adaptive-learner-state-service.ts` 的 I/O、state fields、goal registry、portrait/mastery/privacy projection、feature flag 及所有 production/worker/test/tool callers。
- [x] 1.3 为 `readAdaptiveLearnerState`、`readPathPlannerLearnerState`、direct Prisma reads、client hints、no-evidence/unavailable、portrait v2 和 history revision 建立现状 characterization/parity fixtures。

## 2. Pure reducer and public boundary

- [x] 2.1 定义 normalized `LearnerStateReducerInput`、Learning Record/Assessment read ports、role/goal projector 和 algorithm/evaluation-time contract；reducer 不得包含 Prisma、Next、React 或写副作用。
- [x] 2.2 将 portrait v2、mastery confidence、freshness、privacy、provenance、no-data 和 unavailable 规则迁入纯 reducer，复用 canonical model，不创建第二套画像/掌握度。
- [x] 2.3 实现唯一 Personalization learner-state public API/application adapter，将数据库、evidence cache、Arena/path reads 放入 adapters，并保留历史 revision identity。

## 3. Migrate callers and delete old authority

- [x] 3.1 迁移 learner-state route、profile、AI/Konling、graph center、recommendation、student evidence cache、control-correction report/demo 和 worker 调用者到 public API/read ports。
- [x] 3.2 对每个调用者执行字段级 parity、role/privacy negative tests 和 no-evidence/stale/partial behavior tests；client hints 不得成为 authority。
- [x] 3.3 在零 production import 证据成立后删除旧 service public exports、duplicate read path 和 forwarder；保留其他域仍需的数据表/adapter。
- [x] 3.4 更新 deprecation ledger，记录旧入口、全部消费者、替代 API、删除 revision 和验证证据。

## 4. Targeted and domain verification

- [x] 4.1 增加纯 reducer deterministic/replay、read-port-only、portrait/mastery confidence、privacy projection、identity/revision 和 plugin-missing 测试。
- [x] 4.2 运行 Personalization、Learning Record/data-governance、Assessment read-port 及所有受影响 route/Konling/graph/profile 测试，`rtk npm run typecheck`，并单列既有失败。
- [x] 4.3 运行架构 import/deep-import/Prisma boundary gate，确认无旧 service production import 或第二 reducer。
- [x] 4.4 运行 `rtk openspec validate reduce-personalization-learner-state --type change --strict` 与 `git diff --check`；不执行部署、回填或生产激活。
