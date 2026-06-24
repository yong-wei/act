## Context

课程中的复杂图形不是简单卡片列表。推导、方框图、信号流图、图片标注和局部活动都需要在同一二维空间组织，并被教师释放、学生浏览和后台证据记录共同理解。

## Design Contract

本变更引用 Product Design 合同第 4.1 节 `visual.stage`。合同字段、视觉要求和验收要求是实现完成条件。

## Decisions

1. `visual.stage` 是共享 manifest module，不是某个课程页面私有 JSX。
2. 舞台坐标采用规范化坐标，优先支持 `16:9`、`4:3` 和 `fluid`。
3. 舞台层可承载 diagram、formula、annotation、media、activity、control 等内容，但实际专业组件由后续变更实现。
4. 教师显影作用于舞台层和目标元素，不允许仅通过显示下一张卡片模拟。
5. 视觉舞台必须可在学生端、教师端、浅色、深色、移动端和投影端验证。

## Acceptance Evidence

- 视觉方向稿或组件示意路径。
- 学生端和教师端截图，覆盖浅色与深色。
- 非默认状态截图: 未释放、已释放或显影中。
- manifest audit。
- 证据记录样本: stage id、layer id、reveal state、activity anchor、role、theme。
