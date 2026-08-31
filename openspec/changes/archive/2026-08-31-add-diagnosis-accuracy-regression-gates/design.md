## Context

#1728 为诊断生成加入了薄弱判定校准门禁（最小绝对弱势证据 + 覆盖降级）。Issue #1729 的实验（8 场景 × 3 重复、100 学生、12 节点）量化了修复前的过度诊断，并要求把同一套评测固化为回归门禁。评测必须回答：真实弱点是否仍被发现（召回）、是否引入新误报（精确）、完整薄弱集合是否一致（完全匹配）、重复运行是否稳定（离散度）。

## Goals / Non-Goals

**Goals:**

- 版本化、确定性的基准场景与真值；隐私安全（不含真实学生数据）。
- 可审计的指标计算与统一 run ID 的 JSON/CSV 输出。
- 分层执行：fixture 评测进常规验证（无外部依赖），真实 provider 评测显式手动/计划触发。
- 阈值失败时给出可定位的失败明细（场景、运行编号、预期真值、实际输出）。
- 至少一个"#1728 修复前失败、修复后通过"的过度诊断回归用例。

**Non-Goals:**

- 不在普通 CI 中调用外部大模型。
- 不把 Oracle 理想真值策略实现为产品功能（评测专用）。
- 不以仿真有效性替代真实班级前瞻性对照。
- 不在本变更内修改薄弱判定逻辑（#1728 已完成）。

## Decisions

1. **场景真值由构造参数直接给出**。基准场景以确定性参数（seed、学生数、节点数、每节点的弱势学生注入率、缺失率、冲突配置）生成 governedInput 与真值：被注入弱势的节点集合即 `trueWeakNodes`，注入强度最高者为 `primaryWeakNode`。真值与数据同源生成、同版本冻结，避免手工维护漂移；场景文件携带 `scenarioVersion` 与 seed。
2. **指标按节点级集合比较计算**。以报告知识点 findings 解析出的薄弱节点集合（带 knowledgeNodeId 的 findings 与被校准门接受的知识点发现）对 `trueWeakNodes` 计算 precision/recall/F1；微平均跨场景汇总计数，宏平均按场景平均；完全匹配率 = 集合相等的场景比例；首要弱点命中率 = `findings[0]` 或最高严重度知识点发现的节点等于 `primaryWeakNode` 的比例；健康场景假阳性率 = 健康场景中被报告的知识点节点数 / 全部节点数。治理指标（中文合规、引用有效、归因有效、资源覆盖准确、数值主张支持）复用生产校验函数（语言门、observedRefs、归因门、校准门）在评测侧重放，不重新实现一套语义。
3. **fixture 模式用确定性 provider stub**。runner 支持注入 provider 实现：fixture 模式注入按场景真值构造的确定性输出（含故意过度诊断的负样本），验证指标计算、阈值判断与失败明细生成，不依赖网络。真实模式复用 `resolveSmartLessonStructuredProvider`，每场景重复 ≥3 次，记录模型、prompt、schema、generator 版本与耗时。
4. **run ID 与输出布局**。每次运行生成 `runId = <timestamp>-<mode>-<short-hash>`；输出 `artifacts/diagnosis-benchmark/<runId>/`（`manifest.json`、`summary.json|csv`、`runs/<scenario>/<replicate>.json` 存真值、原始输出、解析结果与指标）。目录只增不改，天然不相互覆盖；manifest 记录全部版本边界（场景版本、seed、provider、model、prompt、schema、生成器、投影、代码 Git 修订）。
5. **阈值作为单一常量表**。验收阈值集中在 runner 常量（微/宏指标、完全匹配、首要命中、健康假阳性、治理合规、资源覆盖），失败输出逐场景、逐 replicate 列出预期与实际。fixture 模式断言阈值判断逻辑本身（含一个故意失败的负样例确保失败路径可诊断），真实模式的阈值门禁在 runner 退出码上体现。
6. **过度诊断回归用例**。fixture 场景 `healthy-class` 配一个确定性 provider 输出：把"相对最低但正常"节点报告为薄弱（#1728 修复前的典型行为）。该输出在当前生产门禁下会被 `DiagnosisFindingCalibrationError` 拒绝——评测断言该拒绝发生且指标把该 replicate 记为"生成失败（校准拒绝）"而非误报，形成"旧行为触发失败、新行为通过"的回归锚点。
7. **执行入口**。`npm run diagnosis:benchmark:fixture`（常规验证，vitest 之外的可执行 runner + vitest 集成断言）与 `npm run diagnosis:benchmark:live`（真实 provider，需显式环境变量开启）。fixture 断言纳入 `rtk npm run test:unit` 可达路径。

## Risks / Trade-offs

- 真实 provider 指标受外部服务波动影响 → live 模式默认不进常规验证，只在候选模型/提示词/发布变更时按计划执行，且重复 ≥3 次取均值与最差。
- 仿真场景不可能覆盖全部真实分布 → 基准集作为回归下界而非有效性证明；场景版本化允许后续扩充。
- 指标与生产校验语义漂移 → 评测直接 import 生产校验函数（语言门/归因门/校准门），单一语义真源。
