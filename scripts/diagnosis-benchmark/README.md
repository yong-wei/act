# 学情诊断准确性回归评测（Issue #1729）

版本化基准集 + 分层评测流程，用于防止诊断准确性与集合一致性回归（#1728 修复的过度诊断行为再次出现）。

## 结构

- `src/lib/diagnosis-benchmark/scenarios.ts`：8 类基准场景与版本化真值（`bench-v1`）。
- `src/lib/diagnosis-benchmark/generate.ts`：确定性 governedInput 生成器（同场景版本 + seed 逐字节稳定）。
- `src/lib/diagnosis-benchmark/metrics.ts`：节点级 P/R/F1、宏/微平均、完全匹配率、首要弱点命中率、健康假阳性率与重复稳定性。
- `src/lib/diagnosis-benchmark/runner.ts`：治理重放（复用生产语言门/证据引用/归因/校准门）、阈值门禁、run ID 与输出布局。
- `scripts/diagnosis-benchmark/run-fixture.ts`：fixture 评测入口（确定性，无网络）。
- `scripts/diagnosis-benchmark/run-live.ts`：真实 provider 评测入口（显式 opt-in）。

## 运行 fixture 评测（常规验证）

```bash
npm run diagnosis:benchmark:fixture
```

产物写入 `artifacts/diagnosis-benchmark/<runId>/`（`manifest.json`、`summary.json`、`summary.csv`、`runs/<scenario>-<replicate>.json`）。目录只增不改，不同运行互不覆盖。

fixture 模式覆盖：

1. 指标计算与阈值判断（含故意触发阈值失败的路径断言，见单测）；
2. **过度诊断回归锚点**：`healthy-class` 场景第 2 次 replicate 固定输出 #1728 修复前的行为（把正常节点判为薄弱），生产校准门将其拒绝并记为 `calibration-rejected`——该 replicate 不计入误报，但若校准门被移除或弱化，该 replicate 会变成健康假阳性并触发阈值失败。

## 运行 live 评测（手动/计划）

```bash
DIAGNOSIS_BENCHMARK_LIVE=1 npm run diagnosis:benchmark:live
DIAGNOSIS_BENCHMARK_REPLICATES=5 DIAGNOSIS_BENCHMARK_LIVE=1 npm run diagnosis:benchmark:live  # 覆盖重复次数
```

live 模式默认每场景 3 次重复，调用真实结构化 provider；用于候选模型、提示词或发布版本变更时的计划性评测。**不要**把 live 评测加入普通提交门禁——外部服务波动会变成不稳定门禁。

## 阈值

| 指标 | 阈值 |
| --- | --- |
| 微平均 precision / recall / F1 | ≥ 0.80 |
| 宏平均 F1 | ≥ 0.80 |
| 弱点集合完全匹配率 | ≥ 0.75 |
| 首要弱点命中率 | ≥ 0.85 |
| 健康场景知识节点假阳性率 | ≤ 0.10 |
| 中文输出 / 证据引用 / 归因合规率 | = 1.00 |
| 资源覆盖（sourceCoverage 数值主张）准确率 | ≥ 0.95 |

阈值失败时 runner 退出码非零，并在 `summary.json` 的 `thresholdFailures` 列出失败指标与逐 replicate 明细（场景、运行编号、预期真值 `expected`、实际输出 `actual`）。

## 添加新场景 / 更新真值

1. 在 `src/lib/diagnosis-benchmark/scenarios.ts` 的 `DIAGNOSIS_BENCHMARK_SCENARIOS` 追加场景：新 `id`、递增 `seed`、注入计划（`weaknessInjection` 即真值；标记 `primary` 的注入为首要弱点）、`progressCoverage`、`assignmentAssessmentConflict` 与允许结论边界。
2. 真值节点必须满足生产校准门槛（班级阈值 `max(3, ceil(20% × 覆盖学生数))`），否则理想输出也会被拒——注入弱势学生数请 ≥ 该门槛。
3. 若修改既有场景的数据形态，递增 `scenarioVersion`（真值变更视同版本变更）；只加新场景不需要动版本号。
4. fixture 与 live runner 会自动纳入新场景，无需改 runner 代码。

## 输出解读

- `manifest.json`：run ID、模式、provider/model/prompt/schema/generator/projection 版本、代码 Git 修订与场景清单。
- `summary.json`：聚合指标、逐场景指标、阈值失败明细、通过与否。
- `runs/<scenario>-<replicate>.json`：该 replicate 的真值与评测解析（治理重放结果、报告节点集合、拒绝原因）。
- `summary.csv`：指标平面表（aggregate 与逐场景行）。

隐私：基准集全部为合成数据（`bench-student-*` / `bench-node-*`），不含真实学生身份、原始答案或私密对话。
