## Why

2026-09-04 QA 巡检（Issue #1940）发现 `/robots.txt` 返回 404 并落入平台 not-found 页面。公开教学站点没有任何爬虫策略声明，既浪费搜索引擎抓取预算（404 页面），也无法保护私有路径（登录、课堂、教师与管理面、API）不被索引。

## What Changes

- 新增公开 `robots.txt`：允许首页、公开课程与仿真入口等公开表面；禁止爬取私有与运营面路径（`/login`、`/profile`、`/dashboard`、`/teacher`、`/admin`、`/classroom`、`/api/` 等），并声明平台入口 sitemap（如后续提供）。
- `robots.txt` 以静态资产交付（`public/robots.txt` 或 App Router 约定路由），无需鉴权、无构建依赖。
- 增加存在性契约测试：`/robots.txt` 返回 200 与 `text/plain`，内容包含对私有路径组的 Disallow。
- 私有路径清单与路由盘点（route inventory）对齐，避免遗漏新私有路由组。

## Capabilities

### New Capabilities

- `public-site-crawler-policy`: 公开站点的爬虫访问策略，保护私有路径并给公开表面确定的抓取指引。

### Modified Capabilities

无。

## Impact

- 新增 `public/robots.txt`（或等价路由）。
- 新能力 spec 首次建立（归档时同步创建主 spec skeleton）。
- 存在性契约测试。
- 不引入鉴权变化——robots.txt 是策略声明，不是访问控制；私有路径的真正保护仍由既有鉴权承担。
