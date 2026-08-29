# Ledger — reconcile-generated-content-authority-invariants

跨域对账矩阵与只读架构 fitness checks 的实现台账。学域运行时契约（Assessment/Assignment/Smart Lesson/Smart Courseware）全部保持域内所有；本 change 不引入 AI superdomain、共享候选表、共享状态机或跨域持久化。

## 1. 冻结的分母与源绑定（tasks 1.1–1.4）

- 源绑定：矩阵 `sourceRevision` 记录对账提交 `5b44e6c128c2f36811a496ac3be272f073d8ba15`（四域行同值，参考标签）；实际绑定判定用 `evidenceDigest`——对矩阵全部被引用证据文件（路径排序）计算的 sha256 内容摘要。fitness check 重算当前摘要并比对：CURRENT 才收敛；STALE（证据文件真实漂移）/UNOBSERVED → 行级 fail-closed（BLOCKED/NOT_QUALIFIED）；HEAD 移动本身不影响绑定。严格门 `npm run test:generated-content-authority` 额外要求干净树。证据文件变更后的再对账流程：重算 `computeEvidenceDigest` → 更新矩阵 `evidenceDigest` → 提交。
- 四域 owner/路由/API/模型/worker/脚本/测试/调用方分母记录在 `src/lib/generated-content-authority/matrix.ts` 的 `GENERATED_CONTENT_AUTHORITY_MATRIX`（每行 `denominator` 字段，全部为已验证存在的仓库相对路径）。
- 各域本地身份：草稿身份、确定性验证证据、人类接受点、不可变修订（含漂移守卫）、发布回执（或等价权威）、隐私类、幂等边界、回滚 owner 均为矩阵行字段。
- 禁止 sink 清单：Assessment 目录发布/运行时 overlay（generated-candidate-catalog.ts / generated-catalog-runtime.ts）、Assignment 评分/反馈权威（assignment-review.ts）、Smart Courseware 发布（publication-service.ts）、LearningFact 写入器三处（canonical writer / learning-fact-materialization / simulation-task-learning-fact）。混合/陈旧证据 → 行 NOT_QUALIFIED。

## 2. 不变量契约与矩阵（tasks 2.1–2.5）

- 七条不变量词表（DRAFT_EDITABLE…DOMAIN_OWNERSHIP）见 `src/lib/generated-content-authority/vocabulary.ts`，是验证视角而非共享枚举/持久化模型。
- 矩阵 schema 即 `GeneratedContentAuthorityRow` 类型 + 提交的矩阵数据；无任何 Prisma 模型（no-shared-persistence）。
- Assessment 行绑定 `reconcile-reviewed-assessment-generation-governance`（#1564，已归档 2026-08-28，tasks 14/14 完成）：fitness check `evaluateAssessmentDependencyQualification` 动态评估其资格（归档存在 + 任务全勾 + 7 个实现/测试证据文件在位）→ 当前 QUALIFIED；若未来证据缺失/不一致 → 行 BLOCKED，不在此 change 内实现 Assessment。
- Assignment rubric / Smart Lesson / Smart Courseware 行引用其既有公共边界与不可变修订（AssignmentRevision.contentHash/frozenAt、SmartLessonRevision 审批字段、SmartCoursewarePublicationRevision.receiptSnapshot）；Smart Lesson 无独立发布回执模型，按 spec 记录为 EQUIVALENT 权威并声明消费边界（SmartCoursewarePublicationRevision.planRevisionId）。

## 3. 只读架构 fitness checks（tasks 3.1–3.4）

实现于 `src/lib/generated-content-authority/fitness.ts`，全部只读（不调用生成/发布服务、不修改产品记录）：

- **sink 扫描**（`scanAuthoritySinkImports`）：TS 级 import 解析（复用 architecture-census/imports）检查声明生成模块是否 import 禁止 sink 模块；命中即 NO_DIRECT_AUTHORITY_WRITE 失败并记录 blockedSinks。
- **跨域深 import**（`scanUndeclaredCrossDomainImports`）：生成模块 import 其它生成域内部必须落在 `DECLARED_CROSS_DOMAIN_IMPORT_PATHS` 允许边（当前仅 smart-courseware → smart-lesson-plan 公共契约一条）。
- **no-superdomain**（`scanSuperdomainViolations`）：产品代码 import 治理矩阵模块、Prisma 声明共享候选/状态模型（GeneratedContentCandidate/GeneratedContentAuthority/UnifiedAiCandidate/SharedCandidate）即失败。
- **回执校验**：契约字段完整性（owner/幂等/回滚/验证/人审/不可变修订/发布证据）、证据路径存在性、矩阵自身隐私扫描（`privacy.ts`：prompt/模型响应/作答/反馈/凭据/用户标识/本机绝对路径的键与值模式）。
- blocked 行保持可见并携带原因；检查器从不改写行状态以外的任何数据。

## 4. 验证与交接（tasks 4.1–4.5）

- 单元/fixture 测试（13 项，`src/lib/generated-content-authority/__tests__/generated-content-authority.test.ts`）：隐私拒绝与放行、干净树收敛、sink 违例 fail-closed、STALE/UNOBSERVED 绑定、#1564 缺证 → Assessment BLOCKED（其余域不连带）、未声明跨域边拒绝 + 声明边放行、共享模型/产品 import 拒绝、每域幂等/回滚/授权证据存在。
- 真仓库评估：四行全 QUALIFIED、violations 为空、Assessment 依赖 QUALIFIED（自洽绑定语义）。
- 严格门：`npm run test:generated-content-authority`（scripts/tests/test-generated-content-authority-gate.ts）以观测 HEAD + 干净树 fail-closed；矩阵绑定之后的任何新提交都会使门进入 STALE，需按本 ledger §1 重新对账并更新 `sourceRevision`。
- 运行级 QA 产物（截图/trace/HAR/log）保持外部化；矩阵结构支持内容寻址 QA 回执（reference/revision/outputHash/toolVersion/conclusion），本 change 未声明任何 QA 回执。

## 5. 与 #1583 的关系

统一 LearningFact 摄取管线（#1583，已合并 integration）是 LearningFact 权威写路径的域内实现；本矩阵把 `canonical-learning-fact-identity/writer.ts` 与 `learning-fact-materialization.ts` 列为全域生成模块的禁止 sink——两个治理层互不隶属、方向一致。

## Codex feedback 修复（2026-08-29，PR #1693）

1. **P1 证据摘要完备性**：`rowEvidencePaths` 纳入 `denominator.tests` 与 `denominator.scripts`；目录类证据（smart-lesson/smart-courseware `__tests__`）递归散列每个文件内容——测试被删除/弱化/新增必然改变 `evidenceDigest`。
2. **P1 回执值结构校验**：QA 回执形状对象（outputHash+toolVersion 同时在场）的 reference/outputHash/toolVersion/revision 必须匹配无空白结构化格式（`unstructured-payload-value` 违例）；自由文本载荷（原始回答、用户标识、模型输出）fail-closed。矩阵描述性 reference 字段不受影响。
3. **P1 允许边收窄**：`DECLARED_CROSS_DOMAIN_IMPORT_PATHS` 从目录前缀收窄到具体公共契约文件（smart-lesson-plan 的 domain.ts/schema.ts）；courseware 生成模块 import `approveSmartLessonDraft` 等权威函数即违例。
4. **P2 import 解析完备**：superdomain/sink/跨域扫描改用自带规范化解析器（@/ 别名 + posix 归一化相对路径 + TS 扩展名候选），相对路径深 import（`../../lib/generated-content-authority/matrix`）同样可判定。

## Codex 第二轮 feedback 修复（2026-08-29，PR #1693）

1. **P1 Assignment 发布服务入禁清单**：`assignment-service.ts`（publishAssignmentRevision）加入 assignment-rubric 禁止 sink；生成路由仅返回可编辑指南（已核验两生成模块 import 不含该文件），教师发布时才固化 rubricSnapshot。
2. **P1 回执字段类型化格式**：结构化校验从"任意无空白串"升级为按字段类型——reference 必须为 64-hex 或仓库相对路径前缀（src|prisma|openspec|data|scripts|docs|external|artifacts）、outputHash 必须 64-hex、revision 必须 7-64 hex、toolVersion 语义版本式；`user:42` 等无空格用户标识同样 fail-closed。

## Codex 第三轮 feedback 修复（2026-08-29，PR #1693）

1. **P1 谱系绑定**：`sourceBinding.headRelation`（ANCESTOR/UNRELATED/UNOBSERVED）经 `git merge-base --is-ancestor` 判定声明修订是否在当前历史中；UNRELATED/UNOBSERVED 行级 fail-closed、settle 拒绝、严格门 `requireReconciledHead` 失败。采用祖先语义而非 HEAD 相等：声明修订写入其自身内容的提交在哈希上不可自指（与 architecture-fitness 的 REQUIRED_BASELINE 产物对比惯例同构）；证据内容漂移由 evidenceDigest 单独判定。
2. **P1 扫描分母补全**：`module-regeneration-service.ts`（Smart Courseware 实际 AI 模块候选生成器，:155）加入 generationModules；已核验其 import 仅含声明公共契约（generated-slide-contract、course-basis、smart-lesson-plan domain/schema），当前树扫描零违例。
3. **P1 回执字段白名单**：回执形状对象仅允许 reference/outputHash/toolVersion/revision/conclusion 五字段，额外字段（如 payload 夹带原始 provider 响应）以 unknown-receipt-field 拒绝；conclusion 限 PASS|FAIL|INCONCLUSIVE 枚举。

## Codex 第四轮 feedback 修复（2026-08-29，PR #1693）

1. **P1 未登记生成模块发现**：sink 扫描分母从"声明 generationModules"扩展为"声明模块 ∪ 四域根内全部 tracked 源文件"（排除 `__tests__`/`*.test.*` 与各行声明的合法消费方豁免：assessment 的 catalog-selector/runtime/persistence、assignments 的 route-guards/public-api、courseware 的 index.ts 桶导出）；rogue generator 直接 import 权威 sink 必被拦截（fixture 测试锁定）。
2. **P1 目录摘要限定跟踪文件**：递归散列与单文件摘要均以 `git ls-files` 为准——`.DS_Store`、`*.log` 等未跟踪本地文件不再阻断绑定判定（脏工作树语义由 mixedWorktree 单独承载）。
3. **P1 QA 回执修订绑定**：每条回执的 `revision` 必须等于行 `sourceRevision`（对账修订），否则行 NOT_QUALIFIED；reference 格式（内容寻址/仓库路径）已在 privacy 层强制。

## 根源重构：default-deny 权威写点发现（2026-08-29，PR #1693）

前五轮 finding 全为同一不变量的症状：**手工枚举的分母天然不封闭**（枚举生成模块漏 API 路由与新文件、枚举 sink 模块被 `prisma.*.createMany` 直写绕过、枚举历史锚点被 squash 破坏）。本轮将扫描模型反转为 default-deny 封闭结构：

1. **权威写点发现**（替换 sink 模块 import 扫描）：全域 tracked 源文件按 `AUTHORITY_WRITE_MODEL_PATTERN`（learningFact/AssignmentRevision/SmartCoursewarePublicationRevision 等权威模型的 prisma 写调用）扫描，每个写点必须落在矩阵登记的 `authorityWriteSites` 白名单内——新文件、API 路由、绕过 writer 的直写默认违例，无需预先登记生成器。
2. **provider 登记制**：全域发现 `@/lib/ai/provider-registry` 与 `'ai'` 调用点，未登记于 `generationModules` 即违例（AI 入口必须显式对账）。
3. **纯内容寻址绑定**：删除 merge-base headRelation（squash 破坏谱系）；绑定判定 = evidenceDigest（含治理文件语义，排除 digest 字段自引用）与当前内容一致——squash/历史重写不影响判定，仅真实内容漂移触发 STALE。

## default-deny 校准完成（2026-08-29，PR #1693）

全域写点发现的首轮运行暴露并完成三类校准（这正是 default-deny 的价值：全部权威写点被强制显式化）：

1. **learningFact 归属修正**：LearningFact 是跨域 Learning Record 权威（document-grading、simulation-agent、historical-evidence、backfill 等多处合法写点），由既有 trusted-learning-fact-filter/canonical identity 契约治理（spec Non-Goal）；从 AUTHORITY_MODEL_DOMAIN 移除，四域矩阵不对其写点做 fail-closed 判定。
2. **评分/批改基础设施写点登记**（assignment 行）：math-document-grading-lifecycle/persistence、teacher-assignment-review-outbox、document-grading approve 路由（人类审批驱动）。
3. **跨域级联清理显式登记**（smart-courseware 行）：smart-lesson-plan/lifecycle.ts 在 lesson archive/delete 时对 courseware 记录的级联清理写点；smart-lesson 行登记 teacher-default-class-service.ts（教师操作驱动的默认任务创建）。

## Codex 对 default-deny 重构的复审修复（2026-08-29，PR #1693）

1. **P1 治理实现纳入摘要**：computeEvidenceDigest 现散列全部治理模块文件（vocabulary/privacy/matrix/fitness/index），matrix.ts 的 evidenceDigest 字段行在散列前归一化为占位符（消除自引用）——削弱扫描逻辑/篡改策略必然 STALE。
2. **P1 learningFact 直写封堵**：LearningFact 建立独立的全域写点白名单（LEARNING_FACT_WRITE_SITES：canonical writer、materialization、simulation/document-grading/backfill 等既有 writer 与人类审批路由），全域扫描中 learningFact 写调用仅允许出现在名单内——生成器直写 prisma.learningFact.create 即违例（fixture 锁定）。
3. **P1 provider 相对路径发现**：provider 发现除文本正则外改用规范化解析器（resolveSpecifier）识别相对路径（../ai/provider-registry）与别名 import；AI 调用模块同时禁止 import 本域禁止 sink（import 即违例）；域外 AI 使用（chat/diagnosis/konling 等非四域）不属本矩阵管辖，明确跳过。

## 结构化违例路由（2026-08-29，PR #1693）

scanDomainAuthorityWrites 改为返回结构化违例（domain/kind/file/detail）而非字符串前缀：属主域违例路由到对应矩阵行 finding；learning-record 域（learningFact 未登记写点）与无属主违例进全局 violations——settled 条件要求 violations 为空，全局违例同样 fail-closed。provider 登记发现范围明确为四域根 + 已登记入口（域外 AI 使用不属本矩阵管辖，写权威模型仍由全域写点发现捕获）；摘要重绑至治理文件纳入后的最终状态。

## 未登记 provider 违例回归修复（2026-08-29，PR #1693）

结构化重构时丢失了"域根内未登记 provider 调用点"的违例生成：已恢复——registeredOwnerDomain 为空且 rootOwnerDomain 非空时，生成属主域的 UNREGISTERED_PROVIDER 违例（仅调用 provider、不 import sink 的 unowned caller 同样不可绕过门禁）；回归测试以 rogue-provider fixture 锁定。摘要重绑至最终治理实现状态。

## 结构化违例路由与 learningFact 白名单补全（2026-08-29，PR #1693）

- scanDomainAuthorityWrites 返回结构化违例（domain/kind/file/detail）：属主域违例路由到行 finding，learning-record/无属主进全局 violations（settle 要求为空）。
- learningFact 建立独立全域写点白名单（LEARNING_FACT_WRITE_SITES），生成器直写 prisma.learningFact.create 即违例；provider 相对路径 import 经规范化解析器识别；AI 调用模块 import 本域禁止 sink 即违例；域外 AI 使用明确不属本矩阵管辖。
- interactive-evidence-scoring-recompute.ts 补入 LearningFact 写点白名单。
- provider 文件中的最终权威模型写（FINAL_AUTHORITY_WRITE_MODEL_PATTERN：修订/回执/评分/发布）一律违例；草稿/任务类写不受限（spec 允许 AI 产出草稿）。

## FINAL 判定与回归测试修复（2026-08-29，PR #1693）

- 修复 FINAL_AUTHORITY_WRITE_MODEL_PATTERN 判定拼接错误（重组文本丢失前导点且重复操作名导致恒 false）：直接对完整匹配文本 match[0] 判定；白名单文件同时调用 provider 并改写最终权威（assignmentSubmission 等）必产生违例。
- 回归测试锁定：白名单文件引入 provider 调用 + tx.assignmentSubmission.update → UNREGISTERED_AUTHORITY_WRITE（assignment-rubric）。
- 摘要重绑至最终治理实现（f7ea8b74）。
