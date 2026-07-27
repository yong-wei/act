## Why

经典四视图工作台会在每次调参后更新唯一的一组分析曲线。学生无法保留基线方案并直接对比后续调整的时域、频域和稳定性变化，只能手工记录参数或依赖截图。

## What Changes

- 为经典四视图工作台增加浏览器会话内的命名方案快照。
- 保存对象、校正器、响应和分析范围等完整设计状态；快照与当前编辑方案相互隔离。
- 提供快照显示、隐藏、重命名、删除与恢复为当前编辑方案的操作。
- 在时域、Bode、根轨迹和 Nyquist 图中，将当前方案与可见快照以稳定颜色和明确图例叠加呈现。
- 保持 Arena 正式提交只读取当前的单一编辑方案，不向评价、排行或评分链路传递对照快照。

## Capabilities

### New Capabilities

- `control-workbench-design-snapshots`: 在经典四视图工作台中管理会话内设计快照及其可见性、恢复和曲线对照。

### Modified Capabilities

- `control-workbench-classic-preset`: 经典四视图预设需要在不改变单方案联动和提交语义的前提下支持快照对照。
- `control-workbench-view-configuration`: 四类视图需要呈现当前方案与多个可见快照的可识别分析结果。

## Impact

- 影响 `src/features/interactive/multi-representation-linkage/` 的设计状态、分析结果输入和图表渲染。
- 影响 `src/features/control-workbench/presets/classic-four-view-preset.tsx` 的经典预设界面。
- 影响共享控制图表面板的多方案系列输入和图例呈现。
- 不修改 Prisma、Arena 评价器、排行榜或提交 API。
