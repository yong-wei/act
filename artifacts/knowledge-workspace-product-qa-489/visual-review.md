# 知识工作区产品 QA 独立视觉复核

复核时间: 2026-06-23T13:15:00+08:00
复核代理: ui-flow-reviewer:019ef2cf-6ed4-7512-924e-77321f99cfa6；critical-reviewer:019ef2e4-ef42-7cd1-8ddb-fcdf355d9176
复核结果: passed
阻断问题: 无

本轮复核基于 `artifacts/knowledge-workspace-product-qa-489/` 下 21 个最新浏览器状态、`browser-evidence.json` 中的 DOM 指标、截图哈希和源码哈希完成。复核确认 `/knowledge` 的本地工具、右侧检查器与 Konling dock 均采用浮层合同，且验收证据能够作为商业 UI gate 的硬闸门。

## 维度结论

- handoffAlignment: PASS。实现与 #680 OpenSpec 合同一致，图谱画布保持视口内，本地工具和检查器不再挤压画布。
- conceptAdoptionRejection: PASS。保留分层语义图谱、深浅双主题和共享平台壳层方向，拒绝独立筛选面板和布局侧栏。
- appShellContinuity: PASS。桌面与移动端均沿用 AppShell，没有出现知识页私有导航壳。
- localTools: PASS。目录、筛选、图例、视图四个桌面工具共享同一工具壳和同一面板槽位。
- semanticMap: PASS。语义图谱主体未被浮层状态破坏，默认态、工具态和压力态均可辨认。
- inspectorHierarchy: PASS。节点详情改为右侧浮动 inspector，并保留标题、元数据、摘要、信息图、关系、证据和学习动作层级。
- konlingDock: PASS。collapsed dock 在 inspector 打开时保持 `left=1326 top=904`，由 inspector 自身通过底部留白避让 dock。
- interactionStability: PASS。hover、drag、显式重新布局、选中节点、降级节点和压力态未出现非预期回流。
- keyboardFocus: PASS。焦点证据覆盖桌面本地工具、移动端工具 sheet、移动端 inspector 和 Konling 展开态。
- themeParity: PASS。深浅主题截图均保持同一信息结构，无明显遮挡或可读性退化。
- mobileBehavior: PASS。320px 下本地工具、选中节点 inspector 和 inspector/Konling 压力态均无页面级滚动，`scrollHeight=viewportHeight=800`。
- tabletBreakpoint: PASS。1100px 宽度处于 AppShell 仍显示移动导航的区间，`tablet-1100-default-dark` 使用 `max-xl` 高度合同，`scrollHeight=viewportHeight=900`，画布保持 `left=24 top=146 width=1052 height=602`。
- stressNonOverlap: PASS。桌面压力态和移动端压力态的 `overlaps` 全部为 `false`。
- canvasGeometry: PASS。采集脚本记录 `rects.canvas`，商业 UI gate 按同视口、同导航基线比较 inspector 相关状态的 `left/top/width/height`；expanded 基线与压力态一致，wide 基线与 wide inspector/tools 状态一致。

## 证据摘要

- `desktop-default-collapsed-dark` 与 `desktop-selected-inspector-light` 的 collapsed dock 坐标一致，均为 `left=1326 top=904`。
- `mobile-320-local-tools-dark`、`mobile-320-selected-inspector-dark`、`mobile-320-inspector-konling-stress-dark` 的 `scrollHeight` 与 `viewportHeight` 均为 `800`。
- `tablet-1100-default-dark` 的 `scrollWidth=viewportWidth=1100`、`scrollHeight=viewportHeight=900`，覆盖 1024-1279px 的移动导航断点回归。
- `desktop-stress-expanded-tool-inspector-konling-dark` 中 expanded Konling、左侧本地工具、右侧 inspector 三者未重叠，`konlingInspectorAvoidance` 为 `active`。
- `desktop-expanded-persisted-dark` 与 `desktop-stress-expanded-tool-inspector-konling-dark` 的 canvas 均为 `left=272 top=93 width=1144 height=847`。
- `desktop-wide-default-dark` 与 `desktop-wide-inspector-tools-dark` 的 canvas 均为 `left=270 top=93 width=1452 height=967`。
