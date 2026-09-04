## ADDED Requirements

### Requirement: 平台壳层交付规范站点图标

平台 SHALL 在 `/favicon.ico` 提供可公开访问的站点图标，浏览器请求该路径 SHALL 得到图片响应而非 404 页面。图标视觉 SHALL 遵循平台品牌资产体系。

#### Scenario: 浏览器请求站点图标

- **WHEN** 任意访客请求 `/favicon.ico`
- **THEN** 响应为图片内容与对应 Content-Type
- **AND** 不返回 404 或 HTML 错误页
