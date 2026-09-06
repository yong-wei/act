# platform-liveness-probe Specification

## Purpose
TBD - created by archiving change add-public-liveness-health-endpoint. Update Purpose after archive.
## Requirements
### Requirement: 平台提供公开存活探测端点

平台 SHALL 在 `/api/health` 提供无鉴权的轻量存活端点：GET 请求返回 200 与最小 JSON 存活表述，不调用数据库或外部依赖，不泄露版本细节、内部路径或配置。就绪检查语义由 `/api/readyz` 承担，两者分工 MUST 在运维文档中写明。

#### Scenario: 存活探测返回最小 JSON

- **WHEN** 任意访客 GET `/api/health`
- **THEN** 返回 200 与 JSON（含 `status: "ok"`）
- **AND** 响应不包含版本号、内部路径或配置信息

#### Scenario: 存活检查不触发依赖调用

- **WHEN** 数据库或 runtime 依赖不可用
- **THEN** `/api/health` 仍返回 200（进程存活）
- **AND** `/api/readyz` 按既有就绪语义报告不就绪

