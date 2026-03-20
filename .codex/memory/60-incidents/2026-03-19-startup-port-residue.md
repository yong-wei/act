# 2026-03-19 startup 脚本端口残留与假成功

状态: active
最后更新: 2026-03-19
摘要: 记录本地 `npm run startup` 表面成功、实际前端很快失效的排障结论。根因不是业务页面 500，而是旧 `next-server` 子进程残留占用 `3001`，脚本只杀 pid 文件中的 `npm` 父进程，导致新实例要么直接 `EADDRINUSE`，要么验证后迅速退出。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/00-index.md)
下游: []
相关:
- [../70-workflows/20-debug-playbook.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/20-debug-playbook.md)
- [../10-project/10-current-state.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/10-project/10-current-state.md)

## 结论

- 启动脚本失败时，先不要把教师页 500 直接归因为业务代码
- 先查 `3001` 端口是否已有残留监听进程，再看 `.logs/error.log`
- `scripts/ops/start.sh` 与 `scripts/ops/stop.sh` 现在都已补上按端口兜底清理逻辑，并在启动完成后把 `frontend.pid` 更新为真实监听进程 PID

## 关键事实

- 旧脚本在前端启动前只读取 `.logs/pids/frontend.pid` 并尝试杀掉该 PID
- 实际上 `npm run dev` 会派生真正监听 `3001` 的 `next-server` 子进程；父进程退出或被杀后，子进程可能仍留在后台
- 因此会出现两种表象：
  - 新前端直接报 `EADDRINUSE: address already in use 127.0.0.1:3001`
  - 启动脚本自检时短暂通过，但后续 `curl /login` 变成 `502`，因为记录在 pid 文件中的并不是实际监听进程

## 证据

- 启动失败时 `.logs/error.log` 明确出现：
  - `Error: listen EADDRINUSE: address already in use 127.0.0.1:3001`
- 同时 `lsof -nP -iTCP:3001 -sTCP:LISTEN` 可看到两个残留 `next-server`
- 最小复现表明 `nohup npm run dev -- --hostname 127.0.0.1 --port 3015` 本身可稳定后台运行，因此问题不在 `nohup` 机制，而在脚本没有正确回收端口与记录真实监听 PID

## 已落地修复

- `scripts/ops/start.sh`
  - 新增 `kill_pid_tree`
  - 新增 `free_frontend_port`
  - 启动前强制释放 `FRONTEND_PORT`
  - `nohup` 增加 `< /dev/null`
  - 启动完成后用 `lsof` 回填真实监听 PID 到 `.logs/pids/frontend.pid`
- `scripts/ops/stop.sh`
  - 停止 PID 时同时处理子进程
  - 增加按 `FRONTEND_PORT` 清理监听进程的兜底逻辑

## 验证方式

1. 运行 `npm run shutdown`
2. 运行 `npm run startup`
3. 再额外确认：
   - `lsof -nP -iTCP:3001 -sTCP:LISTEN`
   - `curl -I http://127.0.0.1:3001/login`
4. 若脚本显示成功但第 3 步失败，优先检查：
   - `.logs/error.log`
   - `.logs/frontend.log`
   - `.logs/pids/frontend.pid`

## 后续提醒

- 若未来把前端端口改为可配置值，优先沿用 `FRONTEND_PORT` 环境变量，不要再把 `3001` 写死在多个位置
- 若再次出现“脚本成功但页面 502/500”，先按这条 incident 排查端口和真实监听 PID，再看页面业务错误
