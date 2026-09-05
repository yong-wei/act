# 知识问答公平基线实验（Issue #1900）

三臂公平对比实验：`plain-baseline`（普通基线）、`enhanced-baseline`（强化提示
基线）、`full-feature`（完整功能组）。三臂共用同一题库、模型、采样参数、证据
上下文与输出预算；强化基线仅缺少专用意图分类、逐单元引用映射与规范
fail-closed 门禁等运行时能力。

## 用法

```bash
# 确定性 fixture（无网络；演示断点续跑可加 --inject <taskKey>=insufficient-balance）
npx tsx --import ./scripts/konling-blind-audit/server-only-shim.mjs \
  scripts/konling-fair-experiment/run-fixture.ts --run-id demo

# live（显式 opt-in；三臂一致采样参数；盲审复用 #1820 judge）
KONLING_FAIR_EXPERIMENT_LIVE=1 npx tsx --import ./scripts/konling-blind-audit/server-only-shim.mjs \
  scripts/konling-fair-experiment/run-live.ts --run-id fair-240-round1

# 评分器口径回放（不重新生成；对同一批冻结快照换口径重评）
npx tsx --import ./scripts/konling-blind-audit/server-only-shim.mjs \
  scripts/konling-fair-experiment/replay-scoring.ts --run-id demo \
  --calibers structure-alias.v1,structure-strict-title.v0
```

## 产物与合同

- 目录：`artifacts/konling-fair-experiment/<runId>/`，含
  `manifest.snapshot.json`（生成修订、评分器修订、题库哈希、模型、采样
  参数、各臂 prompt 版本）、`answers/<arm>/`（冻结回答快照）、
  `scores/<caliber>/<arm>/`（确定性结构评分）、`failures/`（逐 attempt
  失败史）、`summary/official.json` 与 `summary/replay-*.json`。回答冻结时
  一并持久化引用快照（`citations`：id/citationTargetId/verified/displayNumber/
  sourceType/href，first-writer-wins，永不重新生成）；`summary/official.csv`、
  `summary/official.xlsx` 与 `summary/official-slides.md` 由 `official.json`
  同源派生，写前校验真源 complete 与规范哈希，漂移即拒写。
- 断点续跑：同一 `runId` 重复执行即从断点继续；已完成回答永不重新生成
  或覆盖；失败项每轮至多重试一次，累计 attempt 超过一次的留待人工裁决。
- fail closed：缺键/多键、混配置（模型/采样/prompt 版本/修订不一致）、
  manifest 漂移、盲审不完整或引用审计不完整（phase `citation-audit`，含
  citation 快照缺失或非数组）时，不产出正式汇总，脚本以非零码退出。
  live 模式 full-feature 臂在接入真实 citation 冻结前不写 `citations`
  字段（快照不可得≠空快照），同样进入 citation-audit incomplete；
  plain/enhanced 臂无引用功能，空数组是如实快照。
- 指标：每臂结构通过率（按口径）、盲审判定率与均分、综合（结构∧盲审，
  必列分项）、引用精确率（已核验直接支撑数 / 已呈现引用数）与答案单元
  追溯覆盖率（已覆盖单元数 / 应引用单元数，model-derived 章节不入分母）。
  直接支撑判据＝已核验 + 有锚点 + href 可访问 + 答案相关性证据分级在
  白名单内（`answerRelevanceBasis` ∈ 显式引用/查询直接命中；纯语义相似
  `semantic-score`、缺失或未知值一律按「仅相关」保守拒绝；匹配原文
  `answerRelevanceMatch` 在 student pack 脱敏中被删除，判据不依赖它）；判据上限是生产端引用核验 + 直接选中
  证据，主张级蕴含验证超出确定性审计范围（非目标）。逐回答输出失败
  分桶：无标记/标记未分配/引用未核验/引用无锚点或不可访问/仅相关无
  直接支撑证据（含纯语义相似）；model-derived 章节标记与通用漂移
  （evidence-required 结构行/章节外）分列统计，均为唯一编号口径（不与
  出现次数口径叠加）；臂间差值输出绝对值、百分点差、配对 bootstrap 95% CI，
  任一臂池化分母为零（如无引用功能臂的精确率恒 0/0）时该指标差值
  不产出——无样本指标不可当作 0% 参与比较
  （种子记入 manifest，结果可复现）与方向；生成行为差值与评分器口径
  差值分节报告。
- 盲审阶段产物落在 `artifacts/konling-blind-audit/<runId>--audit--<arm>--r<n>/`，
  被审对象是各臂冻结快照（`candidateAnswer` 即该次回答原文）。

## 与既有能力的关系

- 运行目录锁、原子落盘与清单漂移检查复用 `src/lib/ai-eval-run-store/`
  （与 #1820 盲审 store 共享同一实现）。
- `structure-strict-title.v0` 是按 #1817 记载的旧计分规则（固定 canonical
  标题命中）重建的近似口径，不是旧脚本原文；报告不得表述为对旧数据的
  追溯重放。
- 固定回答快照含模型完整回答与题面，属于实验工件，不入 Git（artifacts/
  已忽略）；仅哈希与指标进入正式汇总。
