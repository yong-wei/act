## Why

控制工作台已经能够保存方案快照并叠加四类分析曲线，但学生仍需在分散图表中手工读取指标，难以准确比较方案间的响应速度、超调和稳定裕度变化。

## What Changes

- 在方案快照区域增加当前方案与全部可见快照的关键性能指标对照。
- 允许学生选择当前方案或可见快照作为对照基线；默认使用第一个可见快照，并在基线失效后自动选择有效替代。
- 显示指标原值及相对基线的有单位差值，其中超调量差异使用百分点。
- 区分计算中、分析失败、数据不可用和当前频率范围内未观测到相位交叉等状态。
- 在桌面端提供可横向阅读的表格，并保证 320px 移动端可完整查看方案、指标、单位和差值。
- 保持自由探索语义，不生成综合评分、最佳方案或任务约束结论。

## Capabilities

### New Capabilities

- `control-workbench-metric-comparison`: 在经典四视图工作台中对当前方案与可见方案快照进行关键性能指标量化比较。

### Modified Capabilities

无。

## Impact

- 影响 `src/features/interactive/multi-representation-linkage/` 中的快照分析状态与页面展示。
- 复用 `ControlAnalysisResult.metrics`，不修改 Rust/WASM 分析算法、数据库、Arena 评价器或提交 API。
- 增加指标格式化、基线选择和快照生命周期同步的定向单元测试。
