# Delta: developer-oss-runtime-access

## ADDED Requirements

### Requirement: Developer startup pins a stable resource-index revision
开发启动流程 SHALL 在 pin 活动 Runtime 身份后，为应用进程稳定供给与该身份一致的资源索引 revision 捕获（`APP_REVISION` 或受控 `.app-revision`），SHALL NOT 依赖偶然可用的 Git 工作目录状态；纯本地模式无 release 时 SHALL 显式声明并以受限状态呈现。

#### Scenario: Startup exports the pinned revision
- **WHEN** 协作者运行 `startup:oss-runtime` 且 bootstrap 完成活动身份 pin
- **THEN** 应用进程 SHALL 获得与该 pin 身份一致的资源索引 revision 供给
- **AND** git 捕获不可用（非 work tree、dubious ownership 等）SHALL NOT 导致资源接口以 `MISSING_CAPTURE`/500 失败

#### Scenario: Dirty capture semantics are explicit in development
- **WHEN** 本地 checkout 处于 dirty 状态
- **THEN** 开发模式 SHALL 仅在捕获与 pin 身份一致时接受该捕获，并在 readiness 中呈现 dirty 状态
- **AND** 跨 checkout 漂移或不一致捕获 SHALL fail-closed 并给出具体受限原因

#### Scenario: No silent local fallback for mounted-release delivery
- **WHEN** 已 pin release 的语境下请求 OSS 资源或媒体交付失败（对象不存在、权限拒绝、校验失败、release 不匹配）
- **THEN** 系统 SHALL 呈现具体受限原因，SHALL NOT 静默回退本地 fixture、页面内置样例或普通站内资源以伪造读取成功
- **AND** 失败资源 SHALL NOT 计入 OSS 覆盖与路径区分度
