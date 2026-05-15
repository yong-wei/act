## ADDED Requirements

### Req: protocol version must accept method parameter

`getArenaEvaluationProtocolVersion` 必须接收 `{ taskId: string; method?: ControllerMethod }` 而非仅 `taskId`。

### Req: partition whitebox protocols by evaluation method family

- `analysis-whitebox-v1`: 未来 pid 或 serial-compensator 真实接入 ControlAnalysisResult 后启用
- `template-whitebox-v1`: 当前所有使用启发式或模板化评测的白箱方法（pid、serial-compensator、composite-compensation、optimized-pid、mpc）
- `blackbox-v1`: 黑箱对象
- `code-sandbox-disabled-v1`: code-controller（需要外部沙箱验证）

### Req: cache isolation by protocol version

`prisma-store listSubmissions` 和 `findEvaluationByHash` 必须按新协议版本过滤，确保不同方法族的评测结果不会共用缓存。

### Req: tests cover different protocol versions for same task

同一 task 不同 method 应返回不同 protocolVersion。测试至少覆盖：
- `task-second-order-lead-pid` + `pid` → `template-whitebox-v1`
- `task-second-order-lead-pid` + `serial-compensator` → `template-whitebox-v1`
- `task-cruise-roll-blackbox-identification` + `black-box-control` → `blackbox-v1`
