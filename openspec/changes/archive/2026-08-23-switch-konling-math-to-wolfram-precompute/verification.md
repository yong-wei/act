# Verification

## 当前实现证据

- `calc.wls` 仍是受治理计算真源：HoldComplete 白名单、教学步骤、验算。
- `src/lib/math-calc.ts` 通过 `src/lib/wolfram-cloud-mcp.ts` 调用官方 Cloud MCP `https://agenttools.wolfram.com/mcp` 的 `WolframLanguageEvaluator`，不再 spawn `wolframscript`。
- 官方 Cloud MCP 探测：`initialize` 返回 `serverInfo.name=Wolfram`；`tools/list` 含 `WolframLanguageEvaluator`；完整 `calc.wls` simplify smoke 约 4.6s 返回结构化 JSON。
- 生产镜像不再 `COPY` `wolframresearch/wolframengine:15.0`。现网 49 GB / 7.3 GiB 机器因此不需要为公式计算扩盘扩内存；只需出站 HTTPS。
- 启动探测：`scripts/math-calc/check-wolfram-ready.sh` → `check-wolfram-cloud-mcp.ts`（`1+1` + `calc.wls` Laplace smoke）。
- 作业扫描/GC 使用 `SKIP_WOLFRAM_READY_CHECK=1`，避免 15 秒循环打 Cloud MCP。

## 已跑验证

- `npx vitest run src/lib/__tests__/math-calc.test.ts src/lib/__tests__/wolfram-cloud-mcp.test.ts src/lib/__tests__/konling-math-precompute.test.ts`
- `node scripts/tests/test-docker-migration-readiness.mjs`
- 真实 Cloud MCP：`npx tsx scripts/tests/test-math-calc-wolfram.ts`（需出站访问 `agenttools.wolfram.com`）
- `npx --yes @fission-ai/openspec validate switch-konling-math-to-wolfram-precompute --type change --strict`

## 已跑验证（续）

- 本机控灵 HTTP E2E：`KONLING_E2E_BASE_URL=http://127.0.0.1:3001`，demo 学生会话，题目「求 (s+3)/((s^2+2*s+5)*(s+1)) 的拉普拉斯逆变换」。`scripts/tests/test-konling-http-e2e.mjs` passed；证据 `artifacts/konling-math-http-e2e.json`。断言：无 `calculate` 工具调用、含 Wolfram 声明、含「解题思路 / 详细过程 / 最终答案 / 验算」。本机 HTTP 代理会劫持 localhost，E2E 需 `NO_PROXY=localhost,127.0.0.1`。

## 仍待合并前完成

- GitHub workflow `Wolfram Cloud MCP Verification` 在 PR HEAD 上 green。
