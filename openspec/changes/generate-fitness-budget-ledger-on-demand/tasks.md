## 1. 改为按需生成

- [ ] 1.1 默认 architecture-fitness 检查直接复用现有 ledger 生成函数，合并重复重建，保留预算及输入检查。
- [ ] 1.2 删除跟踪的 ledger JSON 和摘要文件，将现有显式导出输出放到忽略目录；更新 registry、命令说明与相关路径引用。
- [ ] 1.3 调整生成文件对应的 retirement 扫描和测试假设，保留历史记录的含义及实际源码检查，不恢复生成副本。

## 2. 验证

- [ ] 2.1 覆盖无导出文件运行、显式导出、输入缺失/不匹配与预算超限；运行 architecture-fitness-budgets、architecture-fitness 及受影响 retirement 测试。
- [ ] 2.2 运行 fitness:architecture 与 quality-gates:validate，区分原有预算失败与本次回归；运行 typecheck、相关 lint、OpenSpec strict 和 git diff --check。
- [ ] 2.3 确认默认检查不重新写出跟踪文件，简述 Git 文件体量和工具代码的变化。
