# Teacher AI grading lab handoff

最后更新：2026-08-07

## 当前状态

- 仓库：`E:\CODE\grading-lab`
- 分支：`teacher-ai-grading-lab`，已同步 `upstream/integration` 至 `f28affbdd`
- OpenSpec change：`add-teacher-ai-grading-lab`
- OpenSpec CLI：`@fission-ai/openspec 1.6.0`
- 任务进度：`37/49`；`8.2–8.5` 已实现并通过定向回归，已完成一次高推理独立审查，待修复复审后勾选
- 独立审核重新打开的 `5.1`、`5.3`、`5.5`、`5.6`、`6.2` 已修复并通过限定复审
- 当前任务：第十一版调优配置以前台方式运行；Provider 逐分钟限额为 1 次。109 条扣分映射不再阻塞评分一致性运行，但批注扣分覆盖率仍不可用。9.1 尚未完成，隐藏集保持 `SEALED`。
- 未提交、未推送、未创建 PR
- 已有 40 份经逐题签署的脱敏样本；教师逐题分数已作为显式 `teacher-score-only` 基准导入。不要上传聊天或提交 Git。

## 不变边界

- 评测能力属于 ACT 单体，复用现有认证、文档转换、`GradingRun`、分项评分、结构化批注、对象存储和 ACT AI Provider。
- 不建立平行应用、数据库、assignment/submission 模型、评分引擎或实验专用 Provider。
- 不复用会修改生产评分并触发审批/发布链的 `TeacherAssignmentReview` 作为评测修正状态机。
- 不伪造 `Assignment -> Submission -> Attempt -> Evidence` 正式业务谱系。
- 第一阶段不提供学生发布、截止任务、补交或正式成绩写入动作。
- 真实作业、身份映射、解压内容和运行产物只允许位于本机 Git 忽略的受控数据根目录。

## 1–5 阶段摘要

- 已完成安全 ZIP 包契约、`T1S.md` 严格量规解析、合成数据集、敏感文件门禁和本地数据根配置。
- 已完成 DOCX 身份扫描、不可逆脱敏副本、逐份人工确认、模型安全投影和删除/保留记录。
- 已完成 `.docx`/`.doc` 真实格式检测、Word 文本/OMML/图片提取、受控 LibreOffice 转换、固定版面 PDF 和内容完整性门禁。
- 已完成共享评测核心契约、不可变实验配置、逐题三次独立 execution、现有 `GradingRun` 原子创建、租约 fencing、失败隔离、限定重试与恢复。
- execution 仍保持逐题调用粒度；指标按 `(sampleId, repetitionOrdinal)` 聚合为概念性样本重复，不能把逐题 execution 数当作样本运行数。

## 6.x 数据划分、指标与审计记录

主要文件：

- `src/lib/data-governance/teacher-ai-grading-lab-split.ts`
- `src/lib/data-governance/teacher-ai-grading-lab-evaluation-store.ts`
- `src/lib/data-governance/teacher-ai-grading-lab-evaluation-records.ts`
- `src/lib/data-governance/teacher-ai-grading-lab-metrics.ts`
- `prisma/migrations/20260727143000_add_teacher_ai_grading_split_hidden_acceptance/migration.sql`
- `prisma/migrations/20260727170000_add_teacher_ai_grading_evaluation_records/migration.sql`

已实现：

- `scoreBand + primaryErrorType` 复合分层、SHA-256 确定性排名和最大余数约 70/30 分配。
- 隐藏集 `SEALED -> RUNNING -> CONSUMED`，并发单次启动、揭示前消耗提交、跨 split 隐藏样本使用账本和预揭示安全投影。
- split 建立 HiddenAcceptance 后禁止继续插入 member；初始 `split -> members -> acceptance` 顺序保持合法。
- 逐题完全一致率、10% 容差率、三次评分稳定性、批注实质稳定性、四维批注质量、严重误导和覆盖率。
- 转换和样本重复级 AI 成功率、调用量、重试、token、耗时和 BigInt 成本；未知 token/成本保持 `null`，telemetry 缺失时报告 `incomplete`。
- tuning/hidden 分开判定、sealed hidden、PDF pending 和禁止合并分母。
- 追加式批注盲评、转换尝试、Provider 调用尝试和不可变报告快照。

8.1 必须把以下记录 API 接入实际 CLI/shared runner 边界：

- `appendConversionAttempt`
- `appendProviderCallAttempt`
- `appendAnnotationJudgment`
- `persistReportSnapshot`

这些 API 和指标已完成并测试；实际命令行编排属于 8.1，不应在 6.x 重复实现入口。

## 7.x 结构化复核与 PDF

主要文件：

- `src/lib/data-governance/teacher-ai-grading-lab-structured-review.ts`
- `src/lib/data-governance/teacher-ai-grading-lab-pdf.ts`
- `src/lib/data-governance/teacher-assignment-review-derivative-storage.ts`
- `prisma/migrations/20260728110000_add_teacher_ai_grading_structured_review_pdf_verification/migration.sql`

已实现：

- `TeacherAiGradingStructuredReviewVersion` 追加式版本，保存 parent、`accept/correct` 决策、分数修正、批注新增/删除/文字修正/位置修正、操作者、时间和内容哈希。
- 成功实验的 `GradingRun`、`GradingCriterionAssessment`、`GradingAnnotation` 由数据库触发器阻止后续更新、删除及子记录插入；普通生产运行和未成功实验不受影响。
- 数据库从不可变 AI 原始结果和完整、连续、内容哈希校验的 review 父链确定性物化所选结构化结果。
- `createAndPersistTeacherAiGradingLabPdf` 使用物化结果生成 PDF，并持久化源转换、源 PDF 校验和/对象键/大小、生成器版本、锚点版本、结构化结果哈希、语义身份、输出校验和/大小和 review links。
- 页面短标记、详细 PDF `/Text` 原生注释和末尾总分/逐题汇总页。
- 精确锚点不可靠时按声明退化到 `REGION`、`BLOCK`、`QUESTION` 或 `PAGE`；显式 `PAGE` 不会被 questionId 错误升级。
- 短标记和注释图标位于锚框外，避免覆盖原答案；原锚框保存在 `ACTAnchorRect`。
- 隐藏集必须在 acceptance 为 `CONSUMED` 后一次性登记完整 PDF 集合；登记只接受可信生成函数已持久化的 derivative，并重新核验 review 物化哈希和源转换谱系。
- 每份 PDF 固定核验原版面、页面标记、原生注释、定位和汇总页五项；revision 乐观并发控制；任意缺项、失败项或阻断缺陷均不能聚合为通过。

## 验证记录

- 受影响联合 Vitest：15 个文件，`201/201` 通过。
- 5.1–6.2 审核修复定向 Vitest：4 个文件，`87/87` 通过；最终限定复审：2 个文件，`19/19` 通过。
- PDF 定向 Vitest：2 个文件，`26/26` 通过；可信谱系修复后 2 个文件，`21/21` 通过。
- split/evaluation-store：2 个文件，`10/10` 通过。
- Prisma validate：通过。
- 受影响 TypeScript 定向 ESLint：通过。
- `rtk git diff --check`：通过。
- 严格 OpenSpec change 校验：通过。
- Poppler 渲染三页合成 PDF 并逐页检查通过：原页内容和顺序完整、标记不覆盖答案、原生注释和汇总页正常；临时文件已清理。
- 全量 `rtk npm run typecheck` 未通过，错误仅来自既有 `control_engine` WASM 生成物缺失及无关 lesson/simulation `TS2531`；本次文件未出现在错误中。
- 2026-08-06：获取 `upstream/integration` 后，当前分支从 `997717c22` 快进至 `f28affbdd`（上游领先 927 提交）。恢复本地实验改动时仅 `prisma/schema.prisma` 与 `math-document-grading-persistence.ts` 冲突：保留上游 `taskInputDigest` 字段，并合并上游 limitations 投影与本地冻结评测身份契约。同步后定向 Vitest `37/37`、Prisma validate 通过；同步前 stash 暂留为备份，未创建提交。

## 审查裁决

### 5.1–6.3 补充独立审核

- Finding 1：`ACCEPT`。`src/lib/data-governance/index.ts` 公开导出低层 `createRunSet`；该函数只核对 config 与 split ID 和数据来源，没有验证 split membership、partition、HiddenAcceptance 状态，也没有把 evaluator/rubric/question snapshot 与冻结配置逐项绑定。现有消费者可绕过共享核心和 `startTeacherAiGradingHiddenAcceptance`，在 `SEALED` 时创建隐藏集批次或以漂移参数运行。
- Finding 2：`ACCEPT`。评分草稿可先把 `GradingRun` 置为 `AWAITING_REVIEW`；随后 raw-output 写入或归属校验失败时，`fail` 把 execution 置为 `RETRYABLE`，但只更新 state 为 `RUNNING` 的 GradingRun，导致其保持 `AWAITING_REVIEW`。下一次 claim 的 GradingRun fencing 永久失败。`fail` 与 `recover` 的 execution/GradingRun 双表更新也不在同一事务，数据库中途失败可留下状态分裂。
- 修复：公共 index 不再导出低层 run-store 写操作；`createRunSet` 验证 split membership、partition、隐藏集完整成员、HiddenAcceptance 状态和冻结内容哈希。隐藏启动在同一 Serializable 事务内执行 `SEALED -> RUNNING`、完整批次校验、ledger 写入和 batch 绑定。
- 修复：raw-output 重试保留已持久化 draft 和 `AWAITING_REVIEW`，claim 返回 `resumeStage: 'raw-output'`；`fail/recover` 的 execution 与 `GradingRun` 更新进入同一 Serializable 事务并核对双方 update count。
- 限定复审补充 finding：`ACCEPT`。调用方可篡改题目或量规内容并保留旧哈希；隐藏批次可只运行隐藏成员子集但消耗全部成员。已增加规范内容哈希重算、隐藏全集精确匹配和事务回滚测试。
- 最终限定复审：两项原 finding 及两项补充 finding 均 `RESOLVED`。恢复勾选 `5.1`、`5.3`、`5.5`、`5.6`、`6.2`。
- 6.3 基础指标、split freeze member INSERT 修复未发现新的 P1。

### split 冻结后 member INSERT

- 初审：`ACCEPT`。HiddenAcceptance 建立后继续插入 member 会改变隐藏集合。
- 修复：新增 `BEFORE INSERT` 触发器，保留初始写入顺序。
- 复核：`RESOLVED`。

### 成功实验仍可追加 AI 原始子记录

- 独立审查：`ACCEPT`。原触发器只阻止 `UPDATE/DELETE`，未阻止 assessment/annotation `INSERT`。
- 修复：子记录触发器覆盖 `INSERT/UPDATE/DELETE`，按 `TG_OP` 检查 `NEW/OLD.gradingRunId`。
- 限定复审：`RESOLVED`。

### PDF 与所选结构化版本缺少可信绑定

- 独立审查：`ACCEPT`。原实现只校验调用者提供数据的自洽哈希，不能证明来自所选 review 版本。
- 修复：新增数据库物化、完整 review 父链与内容哈希校验、可信生成入口和持久化谱系；隐藏集登记重新核验结构化哈希与源转换。
- 限定复审保留意见：登记未再次重算生成器、锚点、语义身份和输出校验和，假设可直接向 derivative 表插入伪造行。
- 父线程裁决：`REJECT`。仓库中 derivative 只有 `createAndPersistTeacherAiGradingLabPdf` 一个写入点，不存在可传入任意字段的第二个应用写入路径；任意 SQL/Prisma 数据库写权限直接绕过唯一公开生成 API 不属于当前可达应用路径。后续审查不要在没有新增写入点的情况下重复提出该 finding。

## 已知残余风险

- 尚未在真实 PostgreSQL 上执行新增触发器的集成测试；当前由迁移 SQL 契约测试覆盖。
- run-store/evaluation-store 的事务测试使用内存事务模拟，尚未覆盖真实 PostgreSQL `Serializable`、行锁和对象存储删除竞态。
- 极端情况下同页批注过多，页边短标记可能拥挤；隐藏集仍必须逐份人工核验，不能用抽样替代。
- Poppler 环境报告 Symbol/ArialUnicode 字体警告；Helvetica 合成样本实际渲染无乱码。本机仍缺少 LibreOffice 和完整中文字体资产。
- 派生物数据库记录保存输出校验和；8.1 接入本地 artifact storage 时必须在读取/登记前验证实际存储字节与该校验和一致。
- 全量 typecheck 基线问题不属于本 change，不要在此变更中修复。

## 8.1 CLI 与共享核心

- 已新增 `teacher-ai-grading-lab` CLI，支持校验包、导入、划分、冻结、运行、恢复、记录人工判定、计算报告和导出 PDF 核验清单。
- CLI 只负责参数解析、安全错误投影和 JSON 输出，全部业务调用统一进入 `TeacherAiGradingLabCore.execute`；未来 Route Handler 应复用同一生产工厂。
- `pilot` 数据集仅用于 1–2 份已脱敏真实样本的本地包校验与导入。它保持完整 ZIP、量规、校验和和教师基准契约，但共享核心在创建划分、冻结配置、运行、恢复与报告前拒绝它；不得进入调优、隐藏验收、指标或 PDF 核验。
- 已实现可重载的受控 dataset store 和 artifact store；导入后新进程可按 dataset ID/version 重新加载并校验内容。
- production runner 复用现有 Word 转换、证据、ACT Provider、draft persistence、实验 run-store 和隐藏验收状态机，不建立平行评分器或 Provider。
- conversion/provider 成功与失败均追加 attempt；draft 持久化后原子标记 raw-output 阶段，恢复不重跑 Provider或覆盖 draft。
- runner 只读取自动扫描无未处理 finding、负责人逐份确认且校验和一致的脱敏副本；原始 submission 不进入转换或 Provider。
- claim 使用续租 heartbeat 覆盖转换、Provider 和 raw-output 阶段；单 execution 的可记录失败不终止其余批次，有限 claim budget 防止忙循环。
- 报告按 tuning/hidden 分开投影，sealed hidden 不返回明细；报告结果通过 `persistReportSnapshot` 保存不可变快照。
- PDF 只调用 `createAndPersistTeacherAiGradingLabPdf`，写入本地 artifact 后重新读取并校验 SHA-256；隐藏登记只传 derivative ID。
- 联合回归：15 个文件，`210/210` 通过；本轮 `pilot` 定向回归：11 个文件，`126/126` 通过。Prisma、严格 OpenSpec 和 `git diff --check` 均通过。
- 全量 typecheck 的本轮文件无错误；仍被既有 control-engine WASM 缺失和无关 UI `TS2531` 阻断。

## 9.1 数据集状态

### 2026-08-12 运行环境恢复记录

- PostgreSQL 服务 `postgresql-x64-18` 已恢复为 `RUNNING`，私有汇总审计脚本可以连接数据库；未读取、输出或写入 `.env` 内容、学生正文、身份映射或隐藏集数据。
- Redis Windows 服务虽显示 `RUNNING`，但其配置目录 `E:\CODE\project\act-main\data\redis` 不存在，6379 未监听。已将 Redis 作为本机临时依赖启动在 `C:\Users\Oops\AppData\Local\Temp\grading-lab-redis`，并验证 `redis-cli ping` 返回 `PONG`。该临时目录和进程不属于仓库产物，不得提交或作为部署配置。
- 通用 `worker:math-document-grading` 不适用于本次私有调优恢复：它要求完整生产对象存储、扫描器和 Mathpix Worker 配置，当前环境缺失这些受控变量。不得以伪造值绕过 readiness 门禁。
- 已执行 `ensure_tuning_provider_policy.ts`，唯一 `rubric-grading` Provider 策略存在且与冻结条件一致。
- v12 冻结脚本已成功返回 `{"ok":true,"policyCandidates":1,"frozen":true}`。原 `lab-work` 目录拒绝创建 v12 上下文文件（`EPERM`），因此仅将三个私有运行脚本的 v12 上下文输出路径改为 `C:\Users\Oops\AppData\Local\Temp\grading-lab-t1-score-only-run-context-v12.json`；该路径不进入 Git，未包含学生正文或身份映射。
- v12 调优尚未获得可审计的启动确认。尝试以后台命令启动 `run_tuning_evaluation.ts` 时，Codex `exec` 工具返回 `unsupported custom tool call`，无法再次查询数据库确认是否创建新批次。不得将 v12 标记为已运行或完成；恢复后第一步应执行 `inspect_recent_tuning_batches.ts`，按最新创建时间确认是否出现 v12 批次，再决定继续审计或重新启动。
- 旧第十一版批次仍不可作为 9.1 最终结果：最后已审计状态为 154 成功、147 失败、4 运行、31 排队，且使用修复前的 anchor 提示词。隐藏集保持密封，禁止运行或读取。
- 两样本预检请求已验证不可直接执行：`pilot` 数据集不存在实验配置或批次，且仓库对 `first-round` 数据集强制要求 30 至 50 个样本。使用 3 份已确认脱敏样本建立独立输入包后，仓库核心在导入后、划分前以 `first-round datasets require 30 to 50 samples` 拒绝继续；未调用 Provider、未创建预检批次、未读取或运行隐藏集。不得绕过该门禁。若仍需最小端到端预检，需新增显式、隔离的 preflight 数据集契约，并经独立审查后由仓库核心执行。

- 受控包位于仓库外：`E:\CODE\脱敏样本\lab-work\first-round-score-only-package-v1\t1-score-only-20260807.zip`；40 个样本、160 份逐题 DOCX、3 个资源，未进入 GitHub。
- 已导入数据集：`t1-score-only-20260807/v1-score-only`；导入后已在数据集存储内重新建立 160 条脱敏文档与负责人确认记录，避免源 submission 校验和与脱敏副本校验和不一致。
- 已验证数据集存储内全部 160 个 `(sampleId, questionId)` 均可读取为负责人确认的模型提交；未调用模型。
- 基准模式为 `teacher-score-only`：教师逐题分数用于评分一致性指标；不伪造 `criterionId`、`reasonCode` 或结构化扣分。
- 因缺少结构化扣分基准，`annotations.coverage` 明确为不可用，批注指标保持 `incomplete`；完成调优运行后也不能据此宣称首轮全面通过。
- 已创建唯一启用的 `rubric-grading` Provider 策略：按用户确认记录中国处理区域、`2026-08-07-v1` 审批版本、90天最长保留、不用于训练、支持删除，并与当前 SiliconFlow/DeepSeek 运行时绑定。
- 本机已安装 LibreOffice 26.2.5.2。转换器曾因共享用户配置目录无法无界面渲染，现已改为每次转换使用临时隔离配置目录；另修复 `pdfjs` 对 Node `Buffer` 的拒绝，已用已确认脱敏输入验证为 `succeeded`、84个证据块、无完整性问题。
- 历史失败保留：第一版配置的 336 条执行因未安装 LibreOffice 在转换阶段失败；第三版因未隔离 LibreOffice 配置产生 `no-usable-conversion`；第四、五版受网络权限继承问题影响；第八版转换成功但 336 条 Provider 调用因 PDF `file` 附件契约不兼容失败；第九、十版在部分运行中暴露 Provider JSON schema 与锚点质量问题后停止。所有失败记录均保留，未覆盖、删除或重写。
- 已修复 PDF 附件根因：SiliconFlow/DeepSeek 请求仅发送结构化文本和受支持的图像，PDF 仍保留用于本地版面核验、批注定位和输入身份绑定。合成 PDF 附件冒烟返回 HTTP 400，修复后的 PDF 省略冒烟和合成完整评分 schema 冒烟均通过。
- 第十一版冻结配置已将实际模型身份与运行时一致，并保留 Provider 策略版本作为独立参数。运行上下文仍保存旧批次标识，审计已改为以最新创建批次为准；该旧提示词批次当前为 134 条成功、132 条 Provider 阶段失败、4 条运行、66 条排队，但因本轮已接受的 anchor 提示词兼容性 P1，不得作为最终 9.1 结果。新版本已补策略漂移 fail-closed 校验和按证据块精度生成 anchor 的提示词，定向测试通过 `47/47`；待旧批次结束后重新冻结并运行。隐藏集验收及 9.2–9.4 不得提前勾选。
- 本地 Prisma 客户端已重新生成，仓库内 9 条待部署迁移已按顺序部署至本地 PostgreSQL；未重置或删除现有数据。
- 已以固定种子和 70/30 比例创建可重放划分，调优集 28 个样本、隐藏集 12 个样本；隐藏验收仍为 SEALED，未运行、未揭示。
- Provider 策略门禁已满足且冻结脚本验证唯一匹配候选。直接受控网络合成调用成功，但后台子进程不会继承当前会话的临时网络批准；生产样本运行必须在具有持续网络权限的会话中启动。沙箱网络失败属于可审计环境失败，不能据此判定模型质量。

### teacher-score-only 与脱敏迁移独立审查

- 初次高推理独立审查发现两项 P1，均裁决为 ACCEPT：迁移脚本不得以自动调用确认函数替代已完成的人工确认；敏感文件门禁不得因合成目录或既有跟踪状态而放行 Word 文件。
- 迁移已改为仅复用校验和同时匹配导入 submission、既有脱敏文档和 CONFIRMED 审查记录的原字节；不再读取身份映射、重新脱敏或创建自动确认。
- 限定复审确认迁移问题已解决，并确认已跟踪与新加入的 Word 文件都会被拦截；复审还发现合成夹具豁免路径过宽。
- 该残余已收紧为唯一实际合成提交路径，并增加同目录异常 Word 文件的拒绝回归。由于已完成一次修复加限定复审周期，此最后一项只经本地定向回归验证，后续独立审查应覆盖该精确豁免，不得扩大为重复审查无关模块。
- 本轮定向 Vitest、敏感文件检查和 git diff --check 均通过；8.2–8.5 仍因其自身的独立审查结论缺失而保持未勾选。

### 8.1 独立审核裁决

- 原 P1“原始 submission 可绕过脱敏双门禁”：`ACCEPT`，已改为只读取负责人确认的脱敏副本并删除伪造 `CLEAN` 状态。
- 原 P1“长转换/Provider 调用租约过期会中断整批”：`ACCEPT`，已增加续租 heartbeat、fencing 隔离和有限批次循环；限定复审为 `RESOLVED`。
- 限定复审提出“本地可伪造脱敏文件与确认元数据”：`REJECT`。该反例要求直接篡改受控数据根中的副本、扫描记录和负责人确认记录，或绕过 CLI/core 直接调用未暴露 store，等同于本地受控边界失守，不属于当前可达应用路径。没有新增受信任写入口时，后续审核不要重复提出。

## 8.2 教师评测 Route Handler

- 已新增 `POST /api/teacher/ai-grading-lab/operations`：先校验 ACT 会话、`TEACHER` 身份和配置的唯一负责人，再以 Zod 校验操作输入，并将所有业务调用统一转交 `TeacherAiGradingLabCore.execute`。
- 已接入校验、导入、划分、冻结、运行、恢复、隐藏验收揭示、人工判定、报告和 PDF 核验清单操作；客户端提交的人工判定操作者会被服务端会话用户 ID 覆盖。
- 已补齐隐藏验收收束：`reveal-hidden-acceptance` 仅在对应隐藏批次终止后将状态从 `RUNNING` 消耗为 `CONSUMED`，返回 `acceptanceId`、批次 ID 和幂等重放标志，不返回样本、教师基准或隐藏报告明细；随后由现有报告操作按已揭示状态生成报告。
- 定向 Vitest：3 个文件，`31/31` 通过；联合 Vitest：7 个文件，`71/71` 通过；受影响文件 ESLint 通过；`git diff --check` 通过。
- 独立高推理审查已完成，明确接受 Provider PDF 契约冲突、OpenSpec 契约不一致和测试覆盖不足三个 finding；PDF 省略修复、规范同步和回归补充完成后需再次独立复审。审查代理使用 `gpt-5.6-sol` high，并已告知 RTK 绝对路径 `C:\Users\Oops\.cargo\bin\rtk.exe`。

## 8.3 教师评测页面

- 已新增负责人限定的 `GET /api/teacher/ai-grading-lab/overview` 与 `/teacher/ai-grading-lab` 页面。概览只返回数据集 ID/版本/类型/样本数/题目数，以及冻结配置、批次进度和隐藏验收状态；不返回文件名、身份、作业原文或教师基准。
- 文件系统数据集存储新增安全枚举能力，以支持页面列出已导入数据集；目录缺失时返回空集合，非法目录名不会进入投影。
- 当前页面已展示数据集、冻结配置、批次进度、逐题三次运行、已记录批注盲评和已揭示 PDF 核验。密封隐藏批次的逐题、盲评和 PDF 条目均不会进入概览投影。
- 已接入逐题 AI 分数与教师基准对比、已揭示隐藏集 PDF 五项核验，以及匿名批注盲评的负责人提交。盲评和 PDF 记录均要求负责人逐项选择后通过统一操作路由写入，密封隐藏集不生成任何可操作条目。
- `8.3` 的页面主体已完成，待完成 `8.4/8.5` 验证和独立审查后统一勾选。
- 概览路由定向 Vitest `5/5` 通过；操作路由测试当前被既有 `@ai-sdk/provider-utils` 与 `zod` 包导出不匹配阻断，尚未完成本轮联合回归。
- `8.4` 已实现：工作台没有学生发布或成绩写入动作；执行失败、可重试和缺失 AI 结果都会显示为待复核。`8.5` 已新增负责人授权和密封隐藏信息过滤测试；恢复 `rtk.exe` 绝对路径后，概览、核心、CLI 与操作路由定向回归共 `37/37` 通过，受影响 ESLint 和 `git diff --check` 通过。
- 多次只读独立审查均已明确 `rtk.exe` 绝对路径；本轮先进行全范围高推理审查，后按授权/隐藏集边界与页面/测试覆盖拆分为两个互斥的高推理审查，分别等待四至五分钟仍未产出报告，代理均已关闭。`8.2–8.5` 仍待可用审查代理补审，不得仅凭本地回归勾选。

## 数据提供时点

- 已将评测数据契约改为逐题独立提交：manifest 使用 `sample.submissions[]` 绑定 `questionId/path/checksum`，数据集读取、脱敏确认、转换对象键和运行预检均使用 `(sampleId, questionId)`。禁止合并四份 Word 文件；任一题未确认会单独阻断该题。合成包、导入、核心和脱敏回归共 `46/46` 通过。外部 `redact_candidates.ts` 已同步写入 `questionId` 元数据，需重新执行后才能用现有 160 份副本导入。
- 外部 `redact_candidates.ts` 已重新执行：40 个样本、160 份 DOCX 均生成了按题号命名且含 `questionId` 的文档元数据，审查状态仍为 `REVIEW_REQUIRED`。定向 Vitest 共 `74/74` 通过，敏感文件检查通过，`git diff --check` 通过；真实数据仍只在 `E:\CODE\脱敏样本`，未进入仓库。
- 负责人已确认 160 份文件内容。仓库外 `E:\CODE\脱敏样本\lab-work\confirm_redactions.ts` 已对每题 DOCX、文档元数据和审查元数据重验 SHA-256，并以生产配置中反查的负责人身份写入 160 条 `CONFIRMED` 签署记录。身份标识不记录于仓库文档。
- 本轮受影响 TypeScript/测试文件 ESLint 通过。全仓 `tsc --noEmit` 在约 4 GiB Node 堆限制处内存耗尽，未产生诊断；该失败为仓库全量类型检查资源限制，不能据此推断本轮存在类型错误。
- 已将用户提供的私有 `.env` 放入仓库根目录；该文件受 `.gitignore` 规则保护，未读取或输出其内容。`D:\DevTools\PostgreSQL18` 的 PostgreSQL 实例已恢复可用，已据教师工号完成负责人身份反查并写入签署；不在仓库文档、日志或对话中披露 CUID。

- 已发现本机受控目录 `E:\CODE\脱敏样本`：原始归档含 141 份提交，其中 128 份可解析 `.docx` 候选；单份嵌套提交通常含多份 Word 文件，不能仅按文件大小确定正式作业。Excel 为 150 行、26 列的含身份教师记录，存在多项数值评分字段，但尚未核对为逐题确认基准。
- 已收到 `E:\CODE\脱敏样本\T1S.md`，并从本地 Git 历史提交 `e5b284d30` 恢复其 3 项题目资源到 `E:\CODE\脱敏样本\assets\T1\`；正式量规解析通过，四题满分为 `10/20/15/15`。恢复的图片与历史对象 SHA-256 一致，未写入仓库工作树。
- Excel 的四项稳定数值评分列均为 25 分制，另有总分列；这与 `T1S.md` 的四题 60 分制不一致。不得自行缩放、推定题号或将总分拆分为逐题基准。尚未解压原始提交、未创建评测包、未导入数据根、未调用模型，且没有真实数据写入仓库或 Git。
- 负责人已确认 Excel 四项 25 分列按顺序对应 `T1-1` 至 `T1-4`，并要求将 `T1S.md` 四题按比例统一为每题 25 分。该规范化量规必须作为新的受控评测版本保存，不能覆盖原始 `T1S.md`。
- 首次错误地把每个提交包中正文最大的单一 DOCX 当作完整作业；该输出已删除，未导入、未确认、未调用模型。第二次按嵌套顺序把四份 DOCX 赋予 `T1-1` 至 `T1-4`，经负责人抽查发现多处错配，也已删除。当前映射仅在答案正文的题目特征词对某题明显占优、且四份 DOCX 形成完整一对一对应时成立；47 份原始提交满足正文映射，49 份同时具有完整成绩记录，最终从中选出 40 份。负责人已于 2026-08-06 完成人工题号核对；该确认仅覆盖题号对应，不替代 160 份的逐份脱敏内容确认。
- 已在 `E:\CODE\脱敏样本\lab-work\` 从 49 份成绩表匹配且正文语义一对一映射的候选中按成绩段筛选 40 份；`identity-map.json` 含身份映射，必须与 `candidate-draft.json` 和 `redacted\` 脱敏副本隔离。每个脱敏样本位于 `redacted\sample-xxxx\`，包含 `T1-1.docx` 至 `T1-4.docx` 及各自元数据/审查记录，共 160 份，均已签署为 `CONFIRMED`。自动检查显示 160/160 DOCX 可解析、映射姓名/学号和作者元数据残留均为 0；负责人已逐份检查正文、图片、页眉页脚、批注及语境泄露。
- Excel 的每题批语为自由文本，尚未可靠映射到 `T1S.md` 的 rubric criterion；不得将扣分任意归属到某个 criterion 或伪造 reason code。受控规范化量规 `E:\CODE\脱敏样本\lab-work\T1S-25.md` 已生成，并由仓库实际解析器验证为四题各 25 分。现已采用 `teacher-score-only` 基准模式，不要求逐条完成 109 条扣分映射即可启动评分一致性调优；未来若要评估应批注扣分项覆盖率，仍需另行补齐结构化映射。
- 真实数据不要上传聊天，不要提交 Git；身份映射必须与脱敏样本分离保存。

## 操作约束

## 评分量化约束

- 正式实验与预检实验统一使用 0.5 分粒度：题目满分、rubric 条目、人工基准、扣分项和 AI 输出分数均必须为 `0、0.5、1.0、1.5…`。
- 任一分数不得超过所属题目或评分条目的满分；满分 25 分的题目禁止出现 25.5 分。
- 非半分或超分的配置、基准和 AI 输出必须直接拒绝，不得通过归一化、截断或自动修复伪造合规结果。
- 旧 Qwen v1-v5 结果仅用于链路诊断，不属于半分制正式对比结论；切换模型或扩大样本前必须重新生成并验证合规量规。

## 半分制 Qwen 两样本预检（2026-08-13）

- 使用项目自带 SiliconFlow Provider，模型为 `Qwen/Qwen3.6-35B-A3B`；新数据集为 `t1-score-preflight-20260813/v3-half-point`，量规为 `T1S-25-half.md`。
- 预检批次 `experiment-batch:062837cd338dd8c69ad65cdcd3e6905c` 已完成 `24/24`（2 个样本 × 4 题 × 3 次），无失败、无重试耗尽；没有运行隐藏集。
- 所有 AI 输出均为 0.5 分粒度且均未超过题目满分。8 个逐题组中，三次完全可复现 4 组（50%）；最大重复差值 5 分。
- 与人工基准逐次完全一致 `3/24`（12.5%），逐题组至少一次一致 `1/8`（12.5%）。逐题结果已写入本地运行数据库，未在此处输出学生正文或身份信息。
- 该结果仅证明半分制下 Qwen 项目链路可完整运行，不构成 40 份正式实验或首轮验收结论；当前评分一致性明显不足，不能据此进入正式实验。

## 替换第二样本复核（2026-08-13）

- 为排除 `sample-0002` 个体异常，保持 `sample-0001` 不变，将第二样本替换为已确认脱敏的 `sample-0003`，并使用同一 Qwen 模型、同一半分制量规和三次独立运行。
- `sample-0003` 的人工逐题分数为 `17 / 20 / 10 / 25`；Qwen 三次结果分别为 T1-1 `25 / 25 / 25`、T1-2 `24 / 24 / 24`、T1-3 `25 / 25 / 25`、T1-4 `25 / 25 / 25`。
- T1-3 再次出现稳定但显著高估（人工 10，AI 25），因此不能归因于 `sample-0002` 的单样本异常。该批次有 `sample-0001/T1-2` 两次 Provider 失败，整体状态为 `PARTIAL`，不得作为完整预检结论。

## T2 两样本 Qwen 预检（2026-08-13）

- 用户提供 `E:\CODE\脱敏样本\T2`：2 个样本、T2-1/T2-2/T2-3/O2 四道题、逐样本答题记录和 `T2S.md`；题目资源从仓库 `course-content/authoring/shared/homework-problems/2026/assets/T2` 恢复到受控 T2 数据目录。
- 答题记录确定题目满分为 T2-1=20、T2-2=20、T2-3=20、O2=40。原始 `T2S.md` 的 T2-1/T2-3 分步小计为 10 分，与答题记录冲突；未覆盖原文件，另生成 `T2S-20.md` 作为独立评测量规，按答题记录满分重分配并保持 0.5 分粒度。
- 已修复共享解析器兼容实际量规格式：`标准答案`/`分步评分标准`、无连字符题号 `O2`、逐项“分：”写法，以及题目资源 `.m/.py/.tex/.svg`。受影响定向 Vitest：`46/46` 通过。
- T2 预检包：`t2-score-preflight-20260813/v1-half-point-20-20-20-40`，类型 `preflight`，仅含 2 个已脱敏样本；导入校验通过，未运行隐藏集。
- Qwen 使用项目自带 SiliconFlow Provider，模型 `Qwen/Qwen3.6-35B-A3B`。批次 `experiment-batch:504f2f3f4b9a74d76f34db5de2f8ab8d` 已完成 `24/24`（2 样本 × 4 题 × 3 次），`SUCCEEDED`，Provider 调用 `24/24` 成功，无失败、无重试耗尽。
- 人工基准：sample-0001 为 `20/0/20/36`；sample-0002 为 `20/18/18/30`（按 T2-1/T2-2/T2-3/O2 顺序）。AI 三次结果：sample-0001 为 T2-1 `20/20/20`、T2-2 `20/20/20`、T2-3 `20/20/20`、O2 `40/40/40`；sample-0002 为 T2-1 `9/19.5/8`、T2-2 `20/20/20`、T2-3 `7/11/7`、O2 `34/34/36`。
- 所有 AI 分数均符合 0.5 分粒度，且未超过 20/40 分题目上限。8 个逐题组中 5 组三次完全一致（62.5%）；sample-0002 的 T2-1、T2-3、O2 存在重复波动。按每组三次均值计算，8 组总体 MAE 约 `6.02` 分，平均偏差约 `+1.65` 分；该结果只证明 T2 链路完整可运行，不足以进入 40 份正式实验。
- T2 运行上下文保存在 `C:\Users\Oops\AppData\Local\Temp\grading-lab-t2-qwen-preflight-context-v1.json`；真实姓名、原始答题记录和身份信息未进入仓库或对话输出。

- 所有 shell 命令使用 `rtk` 前缀；Python 使用 `python3`。
- 手工编辑使用 `apply_patch`；不运行 `npm install`。
- 不覆盖用户未提交改动；不提交、不推送、不创建 PR，除非用户明确要求。

## 新替换样本 T2 Qwen 预检（2026-08-13）

- 旧目录 `sample-001(old)` 已排除；本轮 `sample-0001` 对应新的 `sample-001`，`sample-0002` 对应 `sample-002`。使用项目自带 SiliconFlow Provider 和 `Qwen/Qwen3.6-35B-A3B`，配置 `experiment-config:c13929232b125c84bba61ce309519b97`。
- 批次 `experiment-batch:457f5acb72fa21fe419b6f3f3c3aa87f` 已 `SUCCEEDED`：24/24 executions 成功、0 失败、Provider 24/24 成功；2 个样本 × 4 题 × 3 次。
- 逐题对比（AI-1/AI-2/AI-3 为同一题的三次独立运行；均值差 = AI 均值 − 人工分）：

  | 样本 | 题目 | 满分 | 人工分 | AI-1 | AI-2 | AI-3 | AI 均值 | 均值差 |
  |---|---|---:|---:|---:|---:|---:|---:|---:|
  | sample-001（新） | T2-1 | 20 | 20 | 19 | 19.5 | 19.5 | 19.17 | -0.83 |
  | sample-001（新） | T2-2 | 20 | 0 | 0 | 0 | 0 | 0.00 | 0.00 |
  | sample-001（新） | T2-3 | 20 | 16 | 14 | 20 | 12 | 15.33 | -0.67 |
  | sample-001（新） | O2 | 40 | 31 | 32 | 31 | 29 | 30.67 | -0.33 |
  | **sample-001 合计** |  | **100** | **67** | **65** | **70.5** | **60.5** | **65.17** | **-1.83** |
  | sample-002 | T2-1 | 20 | 20 | 13.5 | 14 | 15 | 14.17 | -5.83 |
  | sample-002 | T2-2 | 20 | 18 | 20 | 20 | 20 | 20.00 | +2.00 |
  | sample-002 | T2-3 | 20 | 18 | 7 | 7 | 11 | 8.33 | -9.67 |
  | sample-002 | O2 | 40 | 30 | 34 | 34 | 34 | 34.00 | +4.00 |
  | **sample-002 合计** |  | **100** | **86** | **74.5** | **75** | **80** | **76.50** | **-9.50** |
- 所有分数均为 0.5 粒度，且未超过 20/40 上限。三次完全一致的逐题组为 3/8（37.5%）；逐题组至少一次与人工完全一致为 2/8（25%）；逐次执行与人工完全一致为 4/24（16.7%）。
- 按每组三次均值计算，8 组总体 MAE 约 `2.90` 分，平均偏差约 `-1.40` 分（AI 略低估）。相较上一版替换前 T2 预检的 MAE `6.02`，误差明显下降；但 T2-3（尤其 sample-002，均值 8.33 对人工 18）仍有明显低估和重复波动，因此只能确认链路可运行，尚不足以直接进入 40 份正式实验。
- 本轮结果仅统计新替换样本；旧 `sample-001(old)` 的任何结果均不纳入本轮结论。

## T2(max) 正式实验交接（2026-08-13）

### 用户目标

用户已将计划中的 40 份正式实验数据放入 `E:\CODE\脱敏样本\T2(max)`，要求使用项目自带 AI 评分链路和 Qwen 模型完成正式实验，并最终比较 AI 评分与答题记录中的人工评分。

### 已完成的前置检查

- `T2(max)` 下已发现 `sample-001` 至 `sample-040`，共 40 个样本目录；另有 `assets`、`T2S.md` 和 `T2S-20.md`。
- 39 个样本具有四份标准题目文件：`T2-1.docx`、`T2-2.docx`、`T2-3.docx`、`O2.docx`，并各有一份答题记录 `.doc`。
- **sample-030 不符合题目文件契约**：目录中是 `T2-1.docx`、`T2-3.docx`、`T2-4.docx`、`O2.docx`，缺少 `T2-2.docx`。该问题必须由负责人确认：通常应先确认 `T2-4.docx` 是否实际属于 T2-2，再继续正式实验；不能自动重命名或猜测题号。
- 当前尚未为 `T2(max)` 构建评测 ZIP，尚未导入数据集，尚未创建正式实验配置或批次，尚未调用 Qwen。此前两样本批次 `experiment-batch:457f5acb72fa21fe419b6f3f3c3aa87f` 仅属于预检，不能混入正式统计。

### 正式实验预计规模

- 40 样本 × 4 题 × 3 次独立运行 = **480 executions**。
- 题目满分固定为 T2-1=20、T2-2=20、T2-3=20、O2=40。
- 所有人工基准和 AI 输出必须保持 0.5 分粒度，不得超过题目满分。
- 使用 Qwen：`Qwen/Qwen3.6-35B-A3B`，通过项目内 SiliconFlow Provider；不读取、输出或提交 `.env` 内容。

### 采用的评分量规

- 使用独立量规 `T2S-20.md`，不是直接覆盖原始 `T2S.md`。
- 量规已按答题记录统一为 20/20/20/40 分制，并支持 `标准答案`、`分步评分标准`、无连字符题号 `O2`、题目资源 `.m/.py/.tex/.svg` 等格式。
- T2-3 的六项标准为：标准二阶参数与阻尼状态 4 分；低频增益与转折区 3 分；高频幅频趋势与斜率 3 分；相频起止趋势 3 分；自然频率附近峰起趋势 3 分；时域—频域统一解释与边界遵守 4 分。

### 本轮已知经验与坑

1. 不要用 Python 直接运行 `.ts` 文件；必须在仓库目录用 `npx tsx <script.ts>`。
2. 前台运行批次脚本可能超过 120 秒，但数据库批次会继续推进；超时后应检查同一批次并调用 resume，不能重复创建批次。
3. `sample-001(old)` 是旧样本，必须排除；新样本和旧样本不能合并统计。
4. T2-3 对图片形式 Bode 图的识别存在波动；人工评分与量规若不一致，会显著影响 MAE，不能把差异简单归因于模型随机性。
5. 不能自动把 `T2-4.docx` 改名为 `T2-2.docx`。sample-030 的题号必须由负责人确认后再处理。
6. 不得把答题记录中的姓名、学号或 `.env` 中的 API key 写入 HANDOFF、日志、报告或 Git。
7. 旧批次结果只用于诊断经验：上一版 T2 预检 MAE 约 6.02；替换样本后的预检 MAE 约 2.90，但 T2-3 仍有明显误差，不能据此宣称正式实验通过。

### 正式实验启动步骤

1. 负责人确认 sample-030 的 `T2-4.docx` 题号归属。
2. 复制并改造 `_build_t2_preflight.ts`：数据根目录改为 `T2(max)`，遍历 40 个样本，解析每份答题记录的四题人工总分，生成新的正式 `manifest.json`、`baseline.json` 和 ZIP；数据集 ID/version 必须使用新的唯一值，不能复用 preflight 版本。
3. 对所有 160 份题目提交执行脱敏扫描和负责人确认；发现未确认或题号缺失时阻断导入/运行。
4. 运行仓库 CLI 的校验包、导入、划分、冻结配置流程；正式实验不应使用隐藏集明细输出。
5. 使用 Qwen 创建 40×4×3 的正式批次；记录 config ID、batch ID、模型版本、量规版本和数据集哈希。
6. 若命令前台超时，使用同一 batch ID 的 resume 脚本恢复，直到 480/480 成功或明确记录不可重试失败。
7. 生成逐题对比表：样本、题目、满分、人工分、AI 第1/2/3次、AI 均值、差值；另生成每个样本人工总分与三次 AI 总分。
8. 统计 MAE、平均偏差、完全一致率、三次稳定率、0.5 粒度合规率、满分上限合规率，并将结果追加到本文件。

### 当前暂停点

`sample-030` 题号异常已由负责人修正；160 份 `(sampleId, questionId)` 提交也已由负责人逐项确认均为脱敏数据，并完成 SHA-256 绑定。正式 ZIP 已生成且通过仓库验证器。当前尚未导入、未冻结配置、未创建批次、未调用 Provider。

### 正式实验准备进展（2026-08-13）

- 新增可重复准备脚本 `scripts/data-governance/prepare-t2-formal-experiment.ps1`，只读取受控目录，不复制或打包答题记录。
- 正式数据集身份固定为 `t2-formal-first-round-20260813` / `v1-half-point-20-20-20-40`，类型为 `first-round`，未复用任何 preflight ID、版本、ZIP 或哈希。
- 40 份答题记录均为固定 26 段结构；四题人工分数分别位于段落 8、13、18、23，对应 `T2-1/T2-2/T2-3/O2`。脚本按 `20/20/20/40` 上限和 0.5 分粒度 fail closed 校验，并生成本地隔离 `baseline.draft.json`。
- 答题记录只作为最终对比的本地隔离基准源，其中的学生信息、正确答案和评分标准不进入评测 ZIP，不发送给模型，也不写入仓库。
- 已生成 160 项提交 SHA-256 与负责人复核清单 `redaction-review-inventory.json`；负责人已明确逐项确认均为脱敏数据，清单状态已更新为 `CONFIRMED`。
- 源目录三位编号确定性映射为包契约要求的四位编号，例如 `sample-001 -> sample-0001`；源目录不改名，本地清单保留两者映射。
- 正式 ZIP 为 `E:\CODE\脱敏样本\T2(max)-formal-preparation-v1\t2-formal-first-round-v1.grading-lab.zip`。仓库 `validateTeacherAiGradingPackageZip` 校验通过：40 个样本、166 个声明文件，未包含 `.doc` 答题记录。
- 当前未导入、未创建配置或批次、未调用 Qwen；下一步为 F.10。

### F.10 导入与数据库暂停点（2026-08-13）

- 正式 ZIP 已通过生产 CLI 成功导入受控数据根：`t2-formal-first-round-20260813` / `v1-half-point-20-20-20-40`，类型 `first-round`，40 个样本。
- 随后以固定种子 `t2-formal-first-round-20260813-seed-v1` 请求创建 70/30 split。CLI 前台在 120 秒后超时，未返回 split ID。
- 超时后没有重复提交创建请求。使用 Prisma 与原生 `pg` 只读查询均无法建立新数据库会话；PostgreSQL 进程仍在本机 5432 端口监听，但客户端连接超时或被服务端关闭。
- 当前无法判断 split 事务是已提交、回滚还是仍在阻塞，因此不得创建第二个 split，也不得冻结配置。数据库恢复后必须先按 dataset ID/version 查询最近 split、28/12 成员计数与 HiddenAcceptance `SEALED` 状态，再决定是否继续。
- 尚未创建正式 experiment config，尚未创建 batch，尚未调用 Qwen，隐藏集未揭示。

### F.10 完成与 F.11 正式调优批次（2026-08-13）

- PostgreSQL 使用 `pg_ctl -m fast` 受控重启后恢复连接；重启前的 split 超时事务未落库。随后使用相同固定种子成功创建 split `grading-lab-split:39c71b3e63237a1ec3bcba3343d88ca5`，成员为 28 个 `TUNING`、12 个 `HIDDEN`，HiddenAcceptance 为 `grading-lab-hidden:39c71b3e63237a1ec3bcba3343d88ca5`，状态 `SEALED`。
- 160 份负责人确认文件已通过现有脱敏 API 写入受控 `redacted/<sampleId>/` 投影；模型投影使用标准题号文件名，答题记录仍未进入模型上下文。
- 发现并修复生产转换适配器的哈希绑定缺陷：manifest 必须绑定原文件 `sourceChecksum`，模型输入身份使用脱敏文件 `redactedChecksum`。原实现错误地直接比较二者，导致实际清理过元数据的文件全部被拒绝。定向 Vitest `46/46` 通过。
- 保留失败批次 `experiment-batch:3cc48ed37610b5628d39f2a57a5fede1`：336 条在 conversion 阶段以 `teacher-ai-grading-dataset-question-submission-not-found` 失败；不覆盖、不删除。
- 保留失败批次 `experiment-batch:be5d311b85998e1e717439fadad879a7`：修复哈希后 336 条以 `word-processor-version-unavailable` 失败。LibreOffice 实际安装于 `C:\Program Files\LibreOffice\program\soffice.com`，版本 `26.2.5.2`；GUI 启动器 `soffice.exe --version` 会挂起，正式运行显式使用控制台入口。
- 当前冻结配置为 `experiment-config:0eb98e1a372f11ef86101d15da2b8c4a`，提示词版本 `t2-qwen-half-point-v5-libreoffice-command`，模型 `Qwen/Qwen3.6-35B-A3B`，Provider 策略 `2026-08-12-qwen-v1`，附件策略 `images-only.v1`。
- 当前正式调优批次为 `experiment-batch:38c20a090cd3f5c2c5a98ea992254417`，规模 336 executions。后台恢复进程持续针对同一 batch，不得创建重复批次；运行日志位于 `E:\CODE\脱敏样本\T2(max)-formal-preparation-v1\tuning-v3-resume.log`。
- 最近审计状态：13 条 `SUCCEEDED`、3 条 `RUNNING`、319 条 `QUEUED`、1 条 Provider `RETRYABLE(page-anchor-mismatch)`；Provider 成功调用 14 次。该数字仅为运行中快照，不是最终结果。

### T2-3 差异诊断

- 量规对 T2-3 的要求是六项：标准二阶参数与阻尼状态（4 分）、低频增益与转折区（3 分）、高频幅频趋势与斜率（3 分）、相频起止趋势（3 分）、自然频率附近峰起趋势（3 分）、时域—频域统一解释与边界遵守（4 分）。
- 新 sample-001 的正文写出了 `ωn=5`、`ζ=0.4`、欠阻尼以及时频联系；Bode 图以嵌入图形式提交。AI 三次为 `14/20/12`，波动主要集中在 Bode 图可判读内容和评分项 2–4。
- sample-002 的正文非常简略：只写出 `ωn=5`、欠阻尼，并用一句话概括超调、振荡和谐振；没有文字展开低频增益、转折频率、高频 `-40 dB/dec`、相位 `0°→-180°` 等量规要求，也没有可提取的 Bode 图内容。AI 三次为 `7/7/11`，均值 `8.33`；人工记录却给 `18`，说明该样本的人工分数与当前量规存在明显不一致。
- 因此 T2-3 的主要问题不是 Qwen 完全随机，而是人工基准与量规对“简略作答/图形证据”的判定不一致，加上 Bode 图等视觉内容会造成一次运行间的证据识别波动。下一步应先复核人工 18 分是否确实符合六项量规，再决定是否调整样本或量规；不应直接把这两份结果外推到 40 份正式实验。

### 评分项级别 AI 分数

以下为量规评分项的 AI 分数，格式为“AI-1 / AI-2 / AI-3（均值）”。人工答题记录未提供评分项拆分，只提供每道题总分，因此人工列仅保留逐题总分。

| 样本 | 题目 | 人工题目总分 | 评分项1 | 评分项2 | 评分项3 | 评分项4 | 评分项5 | 评分项6 |
|---|---|---:|---|---|---|---|---|---|
| sample-001（新） | T2-1 | 20 | 5 / 5.5 / 5.5（5.33） | 6 / 6 / 6（6.00） | 4 / 4 / 4（4.00） | 4 / 4 / 4（4.00） | — | — |
| sample-001（新） | T2-2 | 0 | 0 / 0 / 0（0.00） | 0 / 0 / 0（0.00） | 0 / 0 / 0（0.00） | 0 / 0 / 0（0.00） | 0 / 0 / 0（0.00） | 0 / 0 / 0（0.00） |
| sample-001（新） | T2-3 | 16 | 4 / 4 / 4（4.00） | 1 / 3 / 1（1.67） | 1 / 3 / 0（1.33） | 1 / 3 / 0（1.33） | 3 / 3 / 3（3.00） | 4 / 4 / 4（4.00） |
| sample-001（新） | O2 | 31 | 8 / 8 / 8（8.00） | 8 / 8 / 8（8.00） | 7 / 7 / 5（6.33） | 9 / 8 / 8（8.33） | 0 / 0 / 0（0.00） | — |
| sample-002 | T2-1 | 20 | 0.5 / 0.5 / 1（0.67） | 5 / 5.5 / 6（5.50） | 4 / 4 / 4（4.00） | 4 / 4 / 4（4.00） | — | — |
| sample-002 | T2-2 | 18 | 2 / 2 / 2（2.00） | 4 / 4 / 4（4.00） | 3 / 3 / 3（3.00） | 4 / 4 / 4（4.00） | 3 / 3 / 3（3.00） | 4 / 4 / 4（4.00） |
| sample-002 | T2-3 | 18 | 4 / 4 / 4（4.00） | 0 / 0 / 0（0.00） | 0 / 0 / 0（0.00） | 0 / 0 / 0（0.00） | 0 / 0 / 3（1.00） | 3 / 3 / 4（3.33） |
| sample-002 | O2 | 30 | 8 / 8 / 8（8.00） | 8 / 8 / 8（8.00） | 8 / 8 / 8（8.00） | 6 / 6 / 6（6.00） | 4 / 4 / 4（4.00） | — |
- 子代理仅使用 `gpt-5.6-sol`；实现完成后必须进行新的独立审查。
- Reviewer findings 由父线程按 `ACCEPT / REJECT / DEFER` 裁决；最多一轮自动修复与限定复审。

### F.11-F.15 正式调优结果（2026-08-13）

- 使用配置 `experiment-config:0eb98e1a372f11ef86101d15da2b8c4a` 与批次 `experiment-batch:38c20a090cd3f5c2c5a98ea992254417`，模型为 `Qwen/Qwen3.6-35B-A3B`，Provider 策略为 `2026-08-12-qwen-v1`，附件策略为 `images-only.v1`。
- 调优集为 28 个样本、336 条 executions；最终 319 条成功、17 条失败、无运行中或可重试项，批次状态为 `PARTIAL`。失败记录保留，未覆盖或删除。
- 失败错误为 `provider-provider-error` 11 条、`page-anchor-mismatch` 5 条、`anchor-excerpt-mismatch` 1 条。Provider 调用记录为 351 次成功、11 次失败。
- 受控调优报告版本为 `cmsrjkgdg0000gsv6zjdij42r`，状态 `fail`：逐次完全一致率 `109/336 = 32.44%`，10% 容差一致率 `191/336 = 56.85%`，三次完全稳定题目组 `60/112 = 53.57%`，三次容差稳定题目组 `81/112 = 72.32%`。
- 处理成功率：转换 `28/28 = 100%`；AI 题目重复完成 `70/84 = 83.33%`。批次存在 17 个失败实例，统计分母未静默排除失败。
- 对比产物已写入受控目录 `E:\CODE\脱敏样本\T2(max)-formal-preparation-v1\formal-results-v1`：`question-comparison.json`、`sample-comparison.json`、`failures.json`。答题记录未进入 ZIP、模型上下文或 Git。
- 当前结论：调优集未达到验收门槛，不得宣称首轮通过；隐藏集保持 `SEALED`，未运行、未揭示，F.16 未完成。T2-3 的人工基准与量规一致性及图形锚点失败仍需人工复核后再决定是否调整量规或处理链。

## 25. 统一闭环清单阶段 1 数据与基准隔离（2026-08-25）

- 正式准备器现强制连续 40 个匿名样本、每样本四份指定答题文件和一份评分记录，并依据文件签名区分 OOXML、OLE 与 Word XML，不再以扩展名代替真实类型。
- 正式 manifest 只绑定 `T2S-20.md`；人工基准离线提取四题分数、派生总分和受限教师批注。审查清单移除源绝对路径，仅保存逻辑键、校验和、类型与只读状态。
- 200 个精确源文件已设为只读，设置前后 SHA-256 差异为 0。正式包通过仓库验证器：40 个样本、120 条非空教师批注。
- 数据集新增 AI 专用 `loadEvaluation()`，创建划分、配置冻结、运行与恢复均不打开 `baseline.json`；物理移除 baseline 的回归测试证明 AI 输入仍可加载，而报告加载会失败。
- 证据见 `docs/operations/assignment-grading-stage-1-data-isolation.md`。阶段 1 实现与验证完成，G.1 独立审核尚未执行，阶段 2 未放行。
- 阶段 1 只读审查准备发现仅验证 ZIP 文件头会接受伪造 `.docx`。该 finding 裁定为 `ACCEPT`：现在还验证 `[Content_Types].xml` 与 `word/document.xml`，正式包重建并通过 ZIP 验证器。

## 26. 阶段 1 独立审核后的限定修复（2026-08-25）

- 独立只读审核对基线 `c2c5ffb` 判定 `FAIL`，六项 finding 均裁定为 `ACCEPT`。修复范围仅覆盖阶段 1 的人工基准隔离、报告读取顺序、评分/批注输入验证、归档门禁与路径安全输出。
- AI 评测 manifest 使用固定的非评分来源分层；报告、实验室概览和受控视觉对比报告在终态独立运行持久化前不读取人工基准。
- 准备器保留受控总分并验证四题一致性；源评分记录未提供独立可用总分字段，故总分由四题有效分数派生。批注在写入 baseline 前经过身份与长度筛除，且只记录抑制数量。
- 本地正式包已重建并经仓库 ZIP 验证器通过。14 个实验室定向测试文件共 178 项、typecheck 和三条 OpenSpec strict validate 均通过。
- G.1 仍未放行：修复基线需冻结，并执行一次限定复审后记录 `PASS` 或 `FAIL`。阶段 2 尚未开始。
