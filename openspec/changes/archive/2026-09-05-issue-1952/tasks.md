## 1. 题库 V2

- [x] 1.1 `KonlingFairExperimentBankItem` 增加可选 `difficulty`/`topic`/`riskType` 分层标注；题库哈希 canonical 覆盖新字段且 V1 哈希不变；新增 `KONLING_FAIR_EXPERIMENT_BANK_V2`（六意图 × 基础/综合/对抗各一条、意图内知识点互异、六种风险类型各至少一条、对抗参考答案显式处置风险）。
- [x] 1.2 题库结构契约测试：覆盖矩阵（意图×难度、风险类型全覆盖、知识点互异）、V1/V2 哈希冻结稳定性。

## 2. 分级盲审

- [x] 2.1 `parseKonlingFairExperimentGradedVerdict`：`correct/minor-flaw/major-error` 三级 + 五子分（accuracy/evidenceFaithfulness/pedagogy/structureCompliance/traceCoverage）0-1 严格校验，非法语义返回 null（parse-failure）；旧解析器不动。
- [x] 2.2 audit 结果类型扩展五子分与分级 verdict；`run-live`/`run-fixture`/`replay-scoring` 支持 `--bank v1|v2`（默认 v2）：v2 用 `konling-blind-audit-graded.v2` 系统提示词与 `rubric-graded.v2`，v1 保持冻结行为；fixture 确定性 provider 按分层标注产出可预期差异。
- [x] 2.3 分级解析测试：合法分级/子分边界、非法枚举、越界与非有限子分 fail closed。

## 3. 判别力报告与专家复核

- [x] 3.1 aggregate 扩展：perArm `auditDimensions`（五子分均值 + verdict 分布）、`ceilingFloor`（≥0.95/≤0.05 比例）、`stratified`（难度×意图分层结构通过率与五子分、分层配对差值复用 buildPairedDifference）、`syntheticDisclaimer` 固定字段。
- [x] 3.2 专家复核子集：config.sampling.seed 派生的分层确定性抽样清单（每意图 1 条）；运行目录 `expert-review/records.json` 双人独立记录 schema；聚合器报告双人分级一致率与分歧清单（pending-teacher 标记），缺失时报告 pending 不阻塞。
- [x] 3.3 报告测试：五维/天花板地板/分层确定性（同种子重跑恒等）/复核一致性与分歧/pending 不阻塞/合成声明字段。

## 4. 验证与交付

- [x] 4.1 bank V2 fixture 端到端（三臂跑通 + 分层报告非退化）；`typecheck`、konling 域相关测试通过；openspec strict validate 后按流程 archive 与 PR 交付。
