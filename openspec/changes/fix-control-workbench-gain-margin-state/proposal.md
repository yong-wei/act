## Why

控制工作台将无有限相位交叉的增益裕度显示为 `--`，与分析层已识别的无穷增益裕度语义不一致。学生无法区分控制系统的稳定裕度结论与分析数据缺失。

## What Changes

- 在控制工作台中以明确状态呈现有限、无穷和不可用的增益裕度。
- 当不存在有限相位交叉时，显示 `GM ∞` 与“无相位交叉”，而非将其显示为缺失值。
- 统一性能指标卡与频域图表提示中的稳定裕度表述，并为状态语义补充测试。

## Capabilities

### New Capabilities

- `control-workbench-stability-margin-presentation`: 在控制工作台中以控制学语义呈现增益裕度和相位交叉频率状态。

### Modified Capabilities

- 无。

## Impact

- `src/resources/control-system/charts/control-analysis-panels.tsx`
- `src/resources/control-system/charts/control-bode-options.ts`
- `src/features/interactive/__tests__/control-charts.test.tsx`
- 控制工作台的 Bode 图、Nyquist 图及性能指标卡展示。
