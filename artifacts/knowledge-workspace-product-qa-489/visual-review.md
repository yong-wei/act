# 知识工作区产品 QA 独立视觉复核

复核时间: 2026-06-23T16:35:03+08:00
复核代理: ui-flow-reviewer:019ef2cf-6ed4-7512-924e-77321f99cfa6；critical-reviewer:019ef2e4-ef42-7cd1-8ddb-fcdf355d9176
复核结果: passed
阻断问题: 无

本轮复核基于 `artifacts/knowledge-workspace-product-qa-489/` 下 26 个最新浏览器状态、`browser-evidence.json` 中的 DOM 指标、截图哈希和源码哈希完成。复核确认 `/knowledge` 的本地工具、右侧检查器与 Konling dock 均采用浮层合同，且验收证据能够作为商业 UI gate 的硬闸门。

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
- tabletBreakpoint: PASS。1024-1279px 宽度处于 AppShell 仍显示移动导航且桌面工具已启用的区间，`tablet-1100-default-dark`、`tablet-1100-local-tools-filter-dark`、`tablet-1100-selected-inspector-dark`、`tablet-1024-inspector-tools-konling-dark`、`tablet-1100-inspector-tools-konling-dark` 与 `tablet-1279-inspector-tools-konling-dark` 均保持 `scrollHeight=viewportHeight=900`，1100px 基线画布保持 `left=24 top=146 width=1052 height=732`。
- stressNonOverlap: PASS。桌面压力态和移动端压力态的 `overlaps` 全部为 `false`。
- canvasGeometry: PASS。采集脚本记录 `rects.canvas`，商业 UI gate 按同视口、同导航基线比较 inspector、本地工具、压力态和 1100px 工具态的 `left/top/width/height`；expanded 基线与压力态一致，wide 基线与 wide inspector/tools 状态一致，1100px 工具态与 1100px 默认态一致。

## 证据摘要

- `desktop-default-collapsed-dark` 与 `desktop-selected-inspector-light` 的 collapsed dock 坐标一致，均为 `left=1326 top=904`。
- `mobile-320-local-tools-dark`、`mobile-320-selected-inspector-dark`、`mobile-320-inspector-konling-stress-dark` 的 `scrollHeight` 与 `viewportHeight` 均为 `800`。
- `tablet-1100-default-dark`、`tablet-1100-local-tools-filter-dark` 与 `tablet-1100-selected-inspector-dark` 的 `scrollWidth=viewportWidth=1100`、`scrollHeight=viewportHeight=900`，覆盖 1100px 常规工具与 inspector 回归。
- `tablet-1024-inspector-tools-konling-dark`、`tablet-1100-inspector-tools-konling-dark` 与 `tablet-1279-inspector-tools-konling-dark` 覆盖 1024-1279px 的移动导航、桌面工具、桌面 inspector 与 Konling 并存压力态；三者的本地工具面板和桌面工具触发区 `rect=null`，`konlingInspectorAvoidance=active`，`expandedDockOverlapsDesktopTools=false`，`expandedDockOverlapsInspector=false`。
- `tablet-1100-local-tools-filter-dark` 中关系筛选面板为 `left=40 top=162 width=466 height=669 bottom=831`，完整落在 900px 视口内，且画布与 1100px 默认态完全一致。
- `tablet-1100-selected-inspector-dark` 中 inspector 为 `left=724 top=314 width=360 height=506 bottom=820`，低于移动导航区域，且画布与 1100px 默认态完全一致。
- `tablet-1024-inspector-tools-konling-dark` 中 inspector 为 `left=648 top=314 width=360 height=506 bottom=820`；`tablet-1100-inspector-tools-konling-dark` 中 inspector 为 `left=724 top=314 width=360 height=506 bottom=820`；`tablet-1279-inspector-tools-konling-dark` 中 inspector 为 `left=903 top=314 width=360 height=506 bottom=820`。三者均低于移动导航区域。
- 桌面 inspector 均锚定在 AppShell 头部下方：`desktop-selected-inspector-light`、`desktop-stress-expanded-tool-inspector-konling-dark` 与 `desktop-wide-inspector-tools-dark` 的 `top=88`，不覆盖 72px 平台头部。
- `desktop-stress-expanded-tool-inspector-konling-dark` 中 expanded Konling、左侧本地工具、右侧 inspector 三者未重叠，`konlingInspectorAvoidance` 为 `active`。
- `desktop-expanded-persisted-dark` 与 `desktop-stress-expanded-tool-inspector-konling-dark` 的 canvas 均为 `left=272 top=93 width=1144 height=847`。
- `desktop-wide-default-dark` 与 `desktop-wide-inspector-tools-dark` 的 canvas 均为 `left=270 top=93 width=1452 height=967`。
