# 知识图谱 UI 审计记录

日期：2026-06-23

## 范围

- 页面：`/knowledge`
- 用户关注点：左侧工具/筛选位置、四个工具面板一致性、右侧详情栏打开后推动画布、详情栏未按悬浮方式贴合画布右侧。
- 对照 active OpenSpec：`make-graph-center-actionable` 主要影响 `src/features/graph-center/*`，当前问题集中在 `src/features/knowledge/*`。修复可以兼容 active change，但需要避免破坏未来 Graph Center 的行动入口和 detail fallback 约定。

## 视觉证据

- `02-knowledge-default.png`：默认图谱。
- `03-knowledge-filter-open.png`：筛选面板打开。
- `08-knowledge-detail-open-from-directory.png`：从目录选择“反馈控制”后右侧详情栏打开。

## 关键测量

默认状态：

- viewport：`1365 x 900`
- 图谱画布：`x=96, width=1245`
- 顶部本地工具：`x=112, width≈557-605`

筛选打开：

- 筛选面板：`x=112, y=229, width=448, height=576`
- 面板右边界小于顶部工具组右边界，形成视觉不对齐。
- 筛选面板走独立绝对定位分支，而目录/图例/视图走顶部工具容器内部的统一面板分支。

详情打开：

- 画布由 `width=1245` 缩小为 `width=835.5`
- 右侧详情栏为 `x=931.5, width=409.5`
- `data-knowledge-inspector="stable-rail"`
- 说明详情栏是布局参与者，不是悬浮层，因此会改变图谱可用宽度和视觉中心。

## 代码定位

- 顶部本地工具容器：`src/features/knowledge/knowledge-graph-system.tsx:815`
- 目录/图例/视图面板：`src/features/knowledge/knowledge-graph-system.tsx:884`
- 筛选独立面板：`src/features/knowledge/knowledge-graph-system.tsx:1292`
- 右侧详情栏稳定栏位：`src/features/knowledge/resource-panel/resource-panel.tsx:398`
- 详情栏对浮动控件避让规则：`src/app/globals.css:198`

## 设计判断

当前 UI 的根因不是单纯间距问题，而是图谱工作台同时存在三套不同面板模型：

1. 顶部本地工具容器内联展开面板。
2. 筛选工具使用独立绝对定位面板。
3. 节点详情使用右侧稳定栏位并参与 flex 布局。

这导致目录、筛选、图例、视图的视觉系统不统一；打开详情后画布被压缩，图谱视角和布局被动变化；多个面板同时打开时，图谱从核心工作区退化为被挤压的背景。

## 建议方向

1. 将 `/knowledge` 的图谱工作区调整为 AppShell 内容区内的全幅 canvas workspace，避免被页面最大宽度和外层 padding 推向中间。
2. 抽出统一的 `KnowledgeLocalToolShell`，让目录、筛选、图例、视图共用同一定位、宽度、关闭、滚动和焦点策略。
3. 筛选只负责筛选，图例只负责关系说明，避免筛选面板混入图例内容。
4. 将 `ResourcePanel` 的桌面形态从 `stable-rail` 改为右侧悬浮 inspector，使用 `absolute/fixed right-4 top-* bottom-*`，不参与 graph flex 宽度计算。
5. 右侧 inspector 与控灵/浮动工具冲突时采用层级和避让规则，不压缩画布。
6. 保留移动端 drawer/sheet 行为，保留列表 fallback 和未来 `make-graph-center-actionable` 需要的 detail actions 插槽。

## 附带缺陷

`/knowledge?node=` 直达节点没有稳定打开详情。代码先读取 URL 参数写入 ref，但实际渲染仍未打开选中节点详情；需要在修复时单独确认 URL 初始化、默认筛选和 `visibleSelectedNode` 的关系。
