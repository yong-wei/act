## Why

fair-live-20260904-r1 先导实验（6 题 × 2 重复，每组 12 条回答）三臂盲审通过率均 100%、均分 97.9-99.2%，出现明显天花板效应：当前题库（`KONLING_FAIR_EXPERIMENT_BANK_V1`，每意图仅 1 题）只能验证实验管线与结构契约，无法稳定区分三组在事实准确性、证据忠实度和教学有效性上的差异；单一模型盲审的 pass/needs-improvement 二值判定加 0-1 ruleScore 也缺乏区分重大错误与轻微缺陷的判别力，且合成参考答案过短（Issue #1952）。

## What Changes

- **题库 V2**（`fair-experiment-v2`）：六意图 × 三难度（基础/综合/对抗）共 18 条，每意图覆盖多个知识点；对抗条目显式携带风险类型标注（错误前提、证据冲突、规范时效、代码隐蔽缺陷、边界条件、信息不足，六种各至少一条）；参考答案扩充为多要点并显式处理风险（识别错误前提、声明信息不足边界）。条目 schema 增加 `difficulty`、`topic`、`riskType` 分层标注，题库哈希覆盖新字段实现冻结。
- **分级盲审量表 v2**（`konling-blind-audit-graded.v2` + `rubric-graded.v2`）：verdict 分级为 `correct`（完全正确）/ `minor-flaw`（轻微缺陷）/ `major-error`（重大错误），并输出五个 0-1 子分——事实准确性、证据忠实度、教学有效性、结构合规、追溯覆盖率；解析器 fail closed（非法枚举/越界子分为 parse-failure）。旧 `rubric.v1` 与 `konling-blind-audit.v1` 冻结保留，V1 题库回放不受影响。
- **报告判别力扩展**：官方摘要在既有 perArm/配对差值之外，分臂报告五维子分均值、结构评分器口径（structure@caliber）与 judge 结构合规子分的并列、天花板（ruleScore≥0.95）与地板（≤0.05）比例、按难度×意图的分层结果与分层配对差值；报告固定携带合成数据声明字段——合成实验结果不得表述为真人学习效果或教学因果结论。
- **教师专家复核子集**：固定种子确定性抽样（分层：每意图 1 条共 6 条）生成复核清单；双人独立复核记录 schema（reviewer A/B 分级判定 + 一致/分歧 + 升级标记）落运行目录；聚合器读取并在摘要报告双人一致率与分歧清单（不自动裁决，分歧保留为待教师裁决项）；复核数据缺失时显式报告 pending 状态。
- 实验入口 `run-live`/`run-fixture` 支持 `--bank v1|v2`（默认 v2）与配套审稿版本；audit 配置进 manifest 冻结既有机制不变。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `konling-fair-baseline-replay-evaluation`: 公平实验题库从单一难度六题扩充为难度×知识点×风险类型分层的十八题题库；盲审从二值判定升级为三级分级量表加五维子分；官方摘要新增五维报告、天花板/地板比例、分层配对结果、合成数据声明与教师双人复核一致性与分歧报告。

### Removed Capabilities

（无）

## Impact

- 代码：`src/lib/konling-fair-experiment/`（bank V2 与条目类型、graded judge 解析、aggregate 报告扩展、expert-review 读取）、`src/lib/konling-blind-audit/types.ts`（条目分层标注可选字段，向后兼容）、`scripts/konling-fair-experiment/run-live.ts`、`run-fixture.ts`（bank/审稿版本参数）。
- 测试：题库结构契约（难度/知识点/风险覆盖、哈希冻结）、graded 解析 fail closed、五维与天花板/地板聚合、复核一致性与分歧、bank V2 fixture 端到端。
- 行为变化：run-live 默认 bank 升为 V2 与 graded 盲审；V1 bank 显式 `--bank v1` 时走冻结的 v1 评分路径。
- 非目标（Issue #1952）：不调整产品提示词以适配特定题库；不以增加重复次数替代题目难度与评分判别力；不实现教师复核录入 UI（复核以运行目录 JSON 线下填写）；不改变生成臂 prompt 合同。
