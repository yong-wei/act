# Design: add-konling-fair-baseline-and-replay-evaluation

## Context

- Issue #1900 引用的 720/450/240 次实验由仓库外一次性脚本完成，仓库内不存在三臂（arm）机制、回答快照或评分器回放。
- 可继承资产：`src/lib/konling-blind-audit/`（#1820：发布槽单胜锁、link(2) 先写胜原子落盘、manifest 漂移 fail closed、混配置拒绝聚合）与 `src/lib/konling-study-question-structure.ts` 的语义别名结构评分器（#1817）。
- 专用能力现状：`buildKonlingTeachingAssistantRuntimeContract`（已导出，konling-agent-runtime.ts:889）在 generic-chat 下经关键词分类自动产出 study-question 合同；`buildKonlingSystemPrompt`（ai-prompt-builder.ts:469-517）把合同渲染为输出合同行、逐单元引用映射与规范核验行。产品路径无任何开关，对照组无法表达"关闭专用运行时"。

## Goals / Non-Goals

- Goals: 三臂公平对比、固定回答快照、评分器口径回放、配对差值报告、fail-closed 溯源，全部可断点续跑。
- Non-Goals: 不改变产品回答逻辑；不把合成学习者结果表述为真实教学因果效果；不以扩大样本量替代公平基线与固定回放；不重建仓库外旧实验数据（旧回答不在仓库内，无法追溯重放）。

## Decisions

### D1. 共享运行目录内核，而不是复制锁实现

从 `konling-blind-audit/store.ts` 抽出与类型无关的部分（发布槽锁 `acquireRunLock`/`assertLockHeld`/`releaseRun`、`writeAtomic`、运行目录准备与 manifest 快照漂移检查、临时文件清理）到共享模块（`src/lib/ai-eval-run-store/`），参数化 artifacts 子目录名。盲审 store 保留原导出面与目录布局，行为不变；新实验 store 复用同一内核。锁语义是并发正确性核心，只允许存在一份实现；盲审既有 23 用例（含锁并发/stale/宽限）作为重构门禁。

### D2. 三臂 prompt 只在实验侧组装，产品代码零开关

- 三臂共用同一用户消息：`问题：…\n参考材料：<referenceAnswer>`；证据以共享参考材料文本提供，不构造 citationContext 编号，引用绑定差异因此不是本实验的测量对象。
- `plain-baseline`：基础控灵系统提示（角色+课程+画像+格式要求），无任何结构合同——即 #1817 之前的基线形态。
- `enhanced-baseline`：同一基础提示 + 与功能组相同的篇幅/结构要求行（`buildStudyQuestionOutputContractLines` 同款三行，纯文本注入，意图取题库标注），不经过专用意图分类、逐单元引用映射、规范 fail-closed 门禁与 calculate 展开规则。
- `full-feature`：产品运行时合同（`buildKonlingTeachingAssistantRuntimeContract(modeId='generic-chat')`，对题面做真实意图分类）+ 产品 prompt builder 渲染。**公平固定**：交付的章节/篇幅合同始终按题库标注意图组装（偏好取 standard/default/full-answer），保证 enhanced 与 full 两臂要求恒等；分类器输出只进入分类一致率指标，不得改变功能组的章节要求。结构评分统一以题库标注意图为唯一口径。
- 臂集合校验：正式实验只接受恰好三个唯一标准臂，缺臂/重复臂在写 manifest 前拒绝。
- 产品默认路径不新增任何分支或 flag；"臂"只存在于实验配置中。

### D3. 题库派生自既有盲审基准

题库条目复用 `KONLING_BLIND_AUDIT_BENCHMARK_V1` 的六意图条目（itemId/intent/question/referenceAnswer），不新造教学内容；replicates 为实验配置。题库哈希 = 规范化 JSON 的 sha256（沿用 `konlingBlindAuditManifestHash` 模式）。快照的 `candidateAnswer` 不参与生成臂；盲审阶段用冻结回答填充派生 manifest。

### D4. 评分口径 = 既有评分器的可选参数，回放 = 纯函数重评

- `structure-alias.v1`：现行语义别名匹配（产品默认，行为不变）。
- `structure-strict-title.v0`：旧式口径——只接受与 canonical 标题规范化后完全相等的标题行，不接受别名与前缀匹配。
- 两种口径都通过 `evaluateStudyQuestionStructure` 的可选 `caliber` 参数表达；回放命令从快照目录读回答，按请求的口径集合重新评分，不触碰生成 provider。
- 评分记录按 `scores/<caliber>/<scorerRevision>/<arm>/` 隔离命名空间：跨评分器修订回放互不覆盖；聚合只读取当前配置修订命名空间，并在评分记录 `gitRevision` 与配置不一致时 fail closed（混配置）。
- 盲审 judge 输出必须通过语义校验（verdict 精确属于 pass/needs-improvement/fail，ruleScore 为有限 0-1 数值），否则记为 parse-failure，不进入冻结记录。
- 盲审阶段复用 `runKonlingBlindAudit`：每臂构造派生 manifest（`benchmarkVersion = <bankVersion>--<arm>`），candidateAnswer 取自该臂冻结快照，runId 派生自实验 runId；盲审记录仍落在 `artifacts/konling-blind-audit/` 下，由实验聚合读取。

### D5. 配对差值用记录种子的确定性 bootstrap

- 指标在 item×replicate 粒度配对；每对臂输出百分点差与配对 bootstrap 95% CI（百分位置信区间，默认 10_000 次重采样）。
- 随机数用 mulberry32（种子记入 manifest），同种子同数据得到同区间，满足可复现审计。
- 生成行为差值（同口径、跨臂）与评分器口径差值（同臂快照、跨口径）输出在独立小节；综合指标（结构∧盲审判定）必须并列输出各分项通过率。

### D6. 目录布局与任务键

```
artifacts/konling-fair-experiment/<runId>/
  manifest.snapshot.json        # 含 bank 哈希、模型、采样参数、臂、口径、种子、修订
  answers/<arm>/<bankVersion>--<arm>--<itemId>--<replicate>.json   # 冻结回答
  scores/<caliber>/<scorerRevision>/<arm>/<taskKey>.json            # 确定性评分结果（按修订隔离）
  failures/…                                                       # 逐 attempt 失败史
  summary/official.json / summary/replay-*.json
```

- 生成阶段任务键 `bankVersion--arm--itemId--replicate`；评分阶段同键，按口径与评分器修订分子目录，天然幂等。
- 聚合阶段做完整性门禁：缺键/多键、混配置（模型/采样/修订不一致）、manifest 漂移一律不产出正式汇总。

## Risks / Trade-offs

- 抽取共享内核触及 #1820 spec 覆盖的代码：以既有测试套件原样通过为重构门禁，不改任何导出语义。
- 旧口径 `structure-strict-title.v0` 是按 #1817 记载的旧计分规则（固定标题命中）重建的近似，不是旧脚本原文；manifest 中口径名与重建依据分开记录，报告不得表述为对旧数据的追溯重放。
- 固定回答快照包含模型完整回答与题面，属于实验工件而非公开证据；不脱敏不入库 Git（artifacts/ 已忽略），仅哈希与指标进入正式汇总。
