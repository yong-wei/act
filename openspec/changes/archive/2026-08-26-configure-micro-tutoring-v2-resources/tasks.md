## 1. 资源投影

- [x] 1.1 将资源投影切换到 v2 错因目录并覆盖全部 272 个错误选项。
- [x] 1.2 保留 registry 身份、学生路径、资源修订和关系来源引用。

## 2. 独立验证

- [x] 2.1 将验证注册表扩展到 135 个 v2 目录题。
- [x] 2.2 为每个验证题绑定独立身份、内容哈希、审核哈希和确定性 revision。

## 3. 验证与交付

- [x] 3.1 运行资源、验证注册表、类型检查和覆盖审计测试。当前 HEAD 证据：`vitest` 5 个相关文件 67 项通过；`npm run typecheck` 通过；`openspec validate configure-micro-tutoring-v2-resources --type change --strict` 通过。
- [x] 3.2 提交并创建关联 Issue #1521 的 PR。
