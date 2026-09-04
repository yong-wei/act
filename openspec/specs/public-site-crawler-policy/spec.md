# public-site-crawler-policy Specification

## Purpose
TBD - created by archiving change add-public-robots-crawler-policy. Update Purpose after archive.
## Requirements
### Requirement: 公开站点提供爬虫访问策略

平台 SHALL 在 `/robots.txt` 公开爬虫访问策略：公开学习表面允许抓取，私有与运营面路径（登录后页面、教师与管理面、课堂、API）MUST 声明为 Disallow。该文件 SHALL 无需鉴权即可获取。

#### Scenario: 爬虫请求 robots 策略

- **WHEN** 任意访客请求 `/robots.txt`
- **THEN** 返回 200 与 `text/plain` 的策略声明
- **AND** 私有路径组（如 `/profile`、`/teacher`、`/admin`、`/api/`）均出现在 Disallow 中

#### Scenario: 公开表面不被误伤

- **WHEN** 检查 robots 策略内容
- **THEN** 首页与公开课程/仿真入口不在 Disallow 范围内

