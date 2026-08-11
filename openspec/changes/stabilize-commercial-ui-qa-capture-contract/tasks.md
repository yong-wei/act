## 1. 捕获合同

- [x] 1.1 为 adaptive-path runner 明确目标服务 URL、可达性和当前源输入校验
- [x] 1.2 以共享 Dock 的可观察触发器和禁用状态作为截图前就绪条件，并输出超时诊断
- [x] 1.3 新增同源 development-only revision probe，并在 runner 捕获前后严格比对服务与本地证明
- [x] 1.4 将截图与 manifest 先写入系统临时 staging，并在 proofs 通过后以固定产品根下的事务式目录替换发布

## 2. 回归验证

- [x] 2.1 为 URL、延迟 Dock 注册、超时和证明绑定添加定向测试
- [x] 2.2 在当前 integration 代码上运行一次 13 状态 runner，确认其不写入待合并产品证据
- [x] 2.3 运行 typecheck、相关测试与 OpenSpec 严格验证
- [x] 2.4 覆盖 probe 的 production 关闭、畸形响应、错修订与捕获期间漂移，并以当前/旧服务进行实际握手验证
- [x] 2.5 覆盖输出子路径边界、符号链接拒绝、staging SHA 重验和原子恢复

## 3. 基线提交

- [x] 3.1 提交并推送独立 #1322 基线 PR
- [ ] 3.2 完成 current-HEAD 独立审查和合并，记录 merge SHA 供 #1169 非改写同步
