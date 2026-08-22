## 1. 覆盖层边界

- [x] 1.1 将 blob-view 父 view 覆盖恢复改为显式知识控制面允许集，并拒绝教材检索热缓存及未声明的普通文件。
- [x] 1.2 保持现有 selector、lifecycle lock、失败恢复和 immutable release 边界，不让覆盖恢复改写 OSS 对象或 release receipt。

## 2. 覆盖后完整性验证

- [x] 2.1 在候选 view 恢复覆盖层后执行 manifest-aware 验证，再选择 current、重建 runtime consumers 或提交 active lifecycle。
- [x] 2.2 使验证明确核对三份教材检索热缓存与 candidate manifest，并在不匹配时保持此前 active runtime。

## 3. 回归与生产修复

- [x] 3.1 添加父 view 含旧普通热缓存、候选 release 含新缓存的激活回归测试，验证旧字节不能覆盖候选内容。
- [x] 3.2 添加覆盖后验证失败的回滚测试，验证容器、current 指针和 lifecycle active receipt 不被错误推进。
- [x] 3.3 通过严格 OpenSpec 校验、定向 runtime release 测试、类型检查和部署脚本契约测试。
- [ ] 3.4 在生产 lifecycle lock 内由 active immutable manifest 与只读 blob 重建当前 host view，保留允许的知识控制面覆盖，并记录复验、app/worker bind 与教材检索 smoke 证据。
