## 1. Characterization and dependency gate

- [x] 1.1 验证 `reconcile-reviewed-assessment-generation-governance`、charter 和 dependency-contract identities 已 qualified/strict-valid，并冻结 reviewed catalog、generation kind 和 publication receipt 输入。
- [x] 1.2 盘点 `next-question`、`submit-answer`、diagnostic、ability-report、profile、adaptive-practice、companion、path execution 的 route、service、Prisma adapter、测试和真实调用者。
- [x] 1.3 为 `globalThis.__adaptiveAssessmentStore`、`generatedQuestions`、`ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED=false`、`*WithPersistenceFallback` 和两份 path-context parser 建立失败前 characterization。

## 2. Assessment public API and vertical path

- [x] 2.1 定义 Assessment public API、application use cases、catalog/attempt/mastery/LearningRecord ports 和 Prisma adapters；禁止 domain core 直接依赖 Next、route 或 Prisma。
- [x] 2.2 将 next-question 完整迁移为服务器派生 path/node/goal/stage → reviewed catalog → durable session/item ref → student-safe response，并保留 immutable catalog snapshot。
- [x] 2.3 将 submit-answer 完整迁移为服务器派生 item ref → score → eligible mastery → governed LearningFact，统一 action/dedupe identity 和事务失败语义。
- [x] 2.4 以数据库版本/唯一约束和有限重试处理 asked-state、answer、mastery、LearningFact 的幂等与并发；冲突不得静默覆盖历史。

## 3. Migrate callers and delete old authority

- [x] 3.1 迁移 diagnostic、ability-report、profile、adaptive-practice、Konling companion、path execution 和 teacher/report 读调用者到 public API/read ports。
- [x] 3.2 保留仍有其他领域消费者的 `Question`/`UserAnswer` 表及只读 adapter，确认它们不再作为 path-owned Assessment 写入真源。
- [x] 3.3 在所有调用迁移并通过针对测试后，删除 Map、持久化 flag、`*WithPersistenceFallback`、重复 context parser 和旧 public exports；不得留下 re-export facade。
- [x] 3.4 更新 deprecation ledger，记录每个删除入口、消费者、替代 public API、迁移 revision 和可验证删除条件。

## 4. Targeted and domain verification

- [x] 4.1 增加 ownership/forged-ref、catalog snapshot、restart durability、duplicate retry、concurrent next-question/submit、score/mastery/LearningFact atomicity 测试。
- [x] 4.2 增加 route compatibility、diagnostic/report/profile/companion/path caller contract 测试，并以负向断言证明不再导入旧入口或 parser。
- [x] 4.3 运行 Assessment、Learning Record/data-governance 和受影响 path domain 测试，`rtk npm run typecheck`，并单列既有失败。
- [x] 4.4 运行 `rtk openspec validate cutover-path-owned-assessment-attempts --type change --strict` 与 `git diff --check`；不执行部署或生产激活。
