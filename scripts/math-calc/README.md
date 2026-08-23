# Wolfram 公式计算运行时

`calc.wls` 仍是受治理计算脚本的真源（HoldComplete 白名单、教学步骤、验算）。生产执行器不再 spawn 本机 `wolframscript`，而是通过官方 **Wolfram Cloud MCP** 调用 `WolframLanguageEvaluator`。

- 默认端点：`https://agenttools.wolfram.com/mcp`
- 传输：Streamable HTTP
- 工具：`WolframLanguageEvaluator`
- 超时：30 秒；并发：1 个计算、8 个排队

官方 Cloud MCP 文档说明该服务可免费使用且不要求认证。可选环境变量：

- `WOLFRAM_CLOUD_MCP_URL`：覆盖默认端点
- `WOLFRAM_CLOUD_MCP_TOKEN` 或 `WOLFRAM_MCP_SERVICE_API_KEY`：若改用需 Bearer 的 Wolfram MCP Service，则作为 `Authorization: Bearer …` 发送

`docker-entrypoint.sh` 在启动迁移前调用 `scripts/math-calc/check-wolfram-ready.sh`：Cloud MCP 不可达、探测失败或无法执行 `calc.wls` smoke 时 `exit 1`。作业扫描/GC 循环设置 `SKIP_WOLFRAM_READY_CHECK=1`，避免每 15 秒冷启动一次云端求值。

验证命令：

```bash
npx tsx scripts/math-calc/check-wolfram-cloud-mcp.ts
npx tsx scripts/tests/test-math-calc-wolfram.ts
npm run test:konling-math-real-smoke
npm run test:docker-migration-readiness
```

生产镜像不再包含 Wolfram Engine，因此不需要额外 8～12 GB 磁盘或 2～4 GB 引擎内存。容器只需能出站访问 `agenttools.wolfram.com`。
