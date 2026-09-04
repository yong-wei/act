## ADDED Requirements

### Requirement: 受保护页登录重定向保留原始目标

未登录访问需要鉴权的页面时，服务端重定向 SHALL 携带 `callbackUrl` 参数，其值为当前请求路径（含查询串）的 URL 编码形式。登录成功后 SHALL 回到该原始目标。显式设计为丢弃目标的角色驾驶舱兜底跳转不受此约束。

#### Scenario: 未登录访问受保护页保留目标

- **WHEN** 未登录用户打开 `/dashboard?tab=evidence`
- **THEN** 重定向目标为 `/login?callbackUrl=%2Fdashboard%3Ftab%3Devidence`
- **AND** 登录成功后回到 `/dashboard?tab=evidence`

#### Scenario: 重定向不开放外站目标

- **WHEN** 构造携带外站地址的 callbackUrl 请求登录页
- **THEN** 登录回跳仅接受站内路径，外站目标被拒绝或替换为角色驾驶舱
