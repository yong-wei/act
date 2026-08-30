## 1. 复现与验证合同

- [ ] 1.1 为 `.act-runtime-blobs` 目标存在但应用用户读取返回 `EACCES`、逻辑工件缺失和链接逃逸建立确定性 fixture，并验证旧启动路径会错误放行这些状态
- [ ] 1.2 定义版本化 required runtime artifact registry，登记微辅导 v2 baseline、选项归因、资源投影和验证题注册表，并以单元测试验证能力启用与工件集合解析

## 2. 消费者身份文件系统门禁

- [ ] 2.1 实现 manifest 全逻辑叶节点验证器，覆盖相对链接 containment、应用 UID/GID 可遍历/可读、大小和 SHA-256，并通过正常与故障 fixture 测试
- [ ] 2.2 生成 credential-free 验证回执，绑定 Release、manifest/tree digest、mount identity、consumer identity、叶节点计数和 required artifact set digest，并验证身份漂移拒绝复用
- [ ] 2.3 将验证器接入 Linux、WSL2 和 Lima bootstrap 的 consumer 启动前门禁，验证任一失败时 frontend、worker、scheduler 均未启动

## 3. 健康检查与限域修复

- [ ] 3.1 扩展 runtime readyz 投影，使其核验当前 bind 与验证回执并执行有界关键工件读取；通过测试确认权限或工件丢失时 `runtime.ready=false`
- [ ] 3.2 实现 checkout-owned repair transaction，按 stop、ownership/lease verification、detach、prepare、attach、verify、select、restart 顺序执行，并验证不影响其他 live worktree
- [ ] 3.3 增加未知 ownership、共享 mount 漂移和重建后仍失败的 fail-closed 测试，确认不删除不确定状态、不回退仓库 runtime、不修改 OSS

## 4. Lima 回归验收

- [ ] 4.1 在 Lima 中用旧故障视图复现 `EACCES` 与缺失 v2 投影，验证新版 bootstrap 在启动前给出精确失败分类
- [ ] 4.2 对同一 pinned Release 执行 repair 后验证 manifest 全量门禁、应用/数据库/Redis readyz、runtime identity 和日志均通过
- [ ] 4.3 执行 54 道 practice 题全部已审核错误选项的微辅导覆盖 smoke，并验证 `stability-margin-frequency-analysis-practice-02` 的 B 选项能够生成微辅导
- [ ] 4.4 运行相关单元/集成测试、`npm run typecheck`、受影响的提交门禁和 `openspec validate fix-developer-runtime-blob-view-readability --type change --strict`

## 5. 运维文档

- [ ] 5.1 更新开发 OSS runtime 诊断与恢复文档，包含 credential-safe 错误分类、精确 repair/stop 命令及禁止手工 chmod、复制 runtime 或改写 OSS 的边界，并通过命令示例 smoke 校验

