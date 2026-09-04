## Why

2026-09-04 QA 巡检（Issue #1937，P1）发现 `/favicon.ico` 返回 404 并落入平台 not-found HTML（约 20KB）。`public/` 目录无 favicon.ico，根布局 metadata 也未声明 icons，浏览器标签页、收藏夹与地址栏均无站点图标，且每次页面加载都白白下载 20KB 404 页面。

## What Changes

- 提供规范的站点 favicon 资产（`app/favicon.ico` 或等价 metadata icons 声明），`/favicon.ico` 直接返回图标而非 404。
- 图标视觉遵循既有品牌资产体系（智控深蓝 / Instrument Atlas 品牌语言），不新造平行视觉。
- favicon 响应不需要鉴权，可被浏览器直接缓存。
- 增加构建产物或路由契约测试：`/favicon.ico` 非 404 且 Content-Type 为图片。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `platform-design-system-and-shell`: 平台壳层拥有全局页面框架，站点图标是其基础资产，必须以受管资产交付而非 404。

## Impact

- `src/app/favicon.ico`（或 `public/favicon.ico` + metadata icons）新增资产文件。
- 根布局 metadata 如需补充 `icons` 声明则最小改动。
- favicon 存在性契约测试。
- 不改动品牌视觉体系、不改 AppShell 结构。
