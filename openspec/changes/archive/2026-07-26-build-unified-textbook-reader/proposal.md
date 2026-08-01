## Why

现有教材引用页只是按物理运行态路径读取单个 Markdown 文件，缺少全书导航、稳定语义地址和精确片段定位。即使检索召回正确内容，用户仍无法在教材层级中核查引用或继续浏览。

## What Changes

- 建立统一教材阅读器：左侧显示可展开的全书章节树，右侧显示当前结构单元正文，并支持在同一教材内自由导航。
- 使用 `/textbooks/{bookId}/{edition}/{...unitPath}` 作为稳定结构路径；公式、插图和表格通过所属结构单元内的片段锚点定位。
- 应用内引用通过拦截式模态路由打开阅读器，关闭后恢复原页面和 URL；直接访问、刷新或分享同一 URL 时显示独立全页双栏视图。
- 引用进入时滚动并聚焦目标单元或片段，同时保留其上下文；机器检索窗口和机器辅助文本不作为阅读页面。
- 教材链接可以分享，但正文只向已登录且具有相应课程访问权限的用户开放。
- 不建立旧 section/chunk 地址到新路径的映射或重定向。

## Capabilities

### New Capabilities

- `unified-textbook-reader`: 定义教材层级阅读、稳定路径、片段定位、模态与独立页面行为，以及教材正文访问控制。

### Modified Capabilities

<!-- None. Citation consumers switch to the reader in integrate-konling-textbook-rag. -->

## Impact

- `src/app/textbook-citations/[...targetPath]/` 现有薄阅读页及其替代路由。
- 新版教材运行态章节树、结构单元正文与片段锚点读取边界。
- Next.js 拦截式/并行路由、共享教材阅读组件、鉴权与课程访问校验。
- 后续控灵引用展示将使用本变更提供的服务器生成地址。
