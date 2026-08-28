## Why

兼容性证明初版已经建立了应用与 Runtime 的独立冻结边界，但审查发现两个遗漏：证明文件名只由 Runtime 身份决定，无法保存同一 Runtime 在不同应用镜像下的多次合格记录；首轮 Authority 协调事务也被日常证明门禁意外阻断。

## What Changes

- 将证明文件改为由完整规范化证明内容的 SHA-256 命名，使同一 Runtime 可以保留多个独立应用镜像与迁移集的证明。
- 将精确证明摘要写入激活日志并传递到 active receipt 投影，恢复时仍能投影正确的证明。
- 保留既有 stopped-service Authority 协调事务，但仅在该事务显式声明迁移意图且具备已有协调授权与绑定时允许无日常证明的历史路径；日常 Runtime 选择仍必须提供证明。

## Impact

- `scripts/runtime-release/` 中的证明、生命周期、事务与 active receipt 投影。
- 协调切换调用点及其部署契约测试。
- `runtime-main-app-compatibility-proof` 与 blob Runtime 生命周期规范。
