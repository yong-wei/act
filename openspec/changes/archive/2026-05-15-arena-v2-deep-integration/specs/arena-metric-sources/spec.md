## ADDED Requirements

### Req: all official metrics must carry source tags

每个 metric 必须标记 `ArenaMetricSource`：`control-analysis` / `derived-from-response` / `derived-from-controller` / `scenario-evaluation` / `blackbox-official` / `unavailable`。

### Req: ITAE computed from step response numerical integration

`extractMetricsFromAnalysisResult` 的 `itae` 字段必须从 `stepResponse.points` 数值积分计算（∫ t·|e(t)| dt），不再返回 null。如 stepResponse 未请求或为空，标记为 `unavailable`。

### Req: non-computable metrics must not silently participate in scoring

不可计算的指标（source=unavailable）不得参与 `normalizeMetricValue` 后默默变 0，应在 scoring 阶段排除并记录。

### Req: hiddenScenarioWorst and comfortBandPeak must not be fabricated

`hiddenScenarioWorst`、`comfortBandPeak` 等需要隐藏场景或频域舒适度评估的指标，不得从普通 step response 伪造。如果不可用，标记 `unavailable`。
