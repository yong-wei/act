---
status: accepted
---

# 在开发工作站使用共享只读 OSS Runtime 身份

合作者在各自电脑的统一 Linux 开发运行层内直接挂载 OSS runtime，不再接收打包资源。项目创建专用 RAM 用户 `act-runtime-dev-read`，共享一组仅覆盖开发运行时只读命名空间的 AccessKey/Secret；该范围与生产 reader 相当，可能包含历史或候选对象，但不允许写入或管理 Bucket，项目结束后统一撤销。

开发服务从生产 `/api/readyz` 获取当前生产运行时发布的标识及 manifest/tree 摘要，验证对应不可变 manifest 后，使用只读 Blob 挂载与物化视图提供 `course-content/runtime`。每次启动固定一个生产活动发布，运行期间不自动切换；Linux 原生使用本机环境，Windows 使用 WSL2，macOS 使用 Linux 虚拟机。

该方案避免复制或预先分发完整 runtime，并复用现有文件系统消费者。代价是共享凭据不能提供个人审计，持有凭据的合作者可绕过启动工具读取只读策略覆盖的整个 runtime 命名空间；这一风险因项目周期有限、合作者可信且凭据可统一撤销而被接受。
