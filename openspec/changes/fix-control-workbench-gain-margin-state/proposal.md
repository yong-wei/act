## Why

控制分析内核用同一个 `null` 表示“当前频率采样范围内没有观测到相位交叉”和“分析数据不可用”。前端据此推断无穷增益裕度，会把范围外的有限交叉错误地呈现为 `GM ∞`。

## What Changes

- 由控制分析内核明确标记有限交叉或当前频率范围内未观测到交叉。
- 当当前采样范围未观测到交叉时，显示“未在当前频率范围内观测到”，而不宣称 `GM ∞`。
- 统一性能指标卡与频域图表提示中的稳定裕度表述，并为状态语义补充测试。

## Capabilities

### New Capabilities

- `control-workbench-stability-margin-presentation`: 在控制工作台中以控制学语义呈现增益裕度和相位交叉频率状态。

### Modified Capabilities

- 无。

## Impact

- `src/resources/control-system/charts/control-analysis-panels.tsx`
- `src/resources/control-system/analysis/types.ts`
- `src/features/interactive/__tests__/control-charts.test.tsx`
- `rust/control-engine/src/lib.rs`
- 控制工作台的 Bode 图、Nyquist 图及性能指标卡展示。
