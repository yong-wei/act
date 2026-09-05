## Why

Active Authority 已使用共享 Force Graph 运行时，两个旧 SVG 画布及其几何辅助函数却仍留在源码中。保留它们的引用来自旧测试和 QA 文件列表，并非生产渲染。

## What Changes

- 删除 `active-authority-force-canvas.tsx`、`active-authority-root-canvas.tsx` 及仅供其使用的颜色、边界和端点计算。
- 删除旧几何实现的专属断言，保留当前共享画布的行为测试。
- 将当前 QA 捕获和检查脚本的源码列表改为实际运行时文件，修订受影响的当前证据。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `active-authority-legacy-force-runtime`：完成旧 Active SVG 实现与测试的删除，当前 QA 只引用现役运行时。

## Impact

涉及 `src/features/knowledge/` 中两个旧画布、`active-authority-graph.tsx` 的孤立辅助函数、相关客户端测试和 QA 脚本。共享 2D/3D 画布、Legacy 数据模式、Authority 数据和生产选择器保持不变。
