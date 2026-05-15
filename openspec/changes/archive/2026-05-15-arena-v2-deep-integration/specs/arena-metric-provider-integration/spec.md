## ADDED Requirements

### Req: evaluateWhiteBoxSubmission must use metric provider, not direct estimateMetrics

`evaluateWhiteBoxSubmission` 必须通过 `WhiteBoxMetricProvider.evaluate()` 获取指标，不得直接调用 `estimateMetrics`。编排流程：

```
validateConfig → summarizeController → evaluateHardConstraints → selectProvider(method) → provider.evaluate() → evaluateMetricProfile
```

### Req: select provider based on method family

`selectWhiteBoxMetricProvider(method)` 根据 method 选择合适的 provider：
- `pid` / `serial-compensator`: 当前返回 `heuristicWhiteBoxMetricProvider`，protocol 为 `template-whitebox-v1`
- `composite-compensation` / `optimized-pid` / `mpc`: 返回 `heuristicWhiteBoxMetricProvider`，protocol 为 `template-whitebox-v1`

### Req: metric-profile-evaluator reused by main evaluation path

`evaluateMetricProfile`（来自 `metric-profile-evaluator.ts`）必须被官方评测主链路复用，工作台预评测和官方评测使用相同的满意度/评分/惩罚/解释计算口径。

### Req: evaluateArenaSubmission remains single official entry point

`evaluateArenaSubmission` 仍然是唯一官方评测入口，不得新增平行评测 API 路由。
