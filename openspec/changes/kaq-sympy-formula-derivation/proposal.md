## Why

KAQ 的 formula-derivation 目前纯靠 LLM 文本生成推导，没有实际数学计算能力。LLM 可能在多项式展开、导数/积分、拉普拉斯变换等环节产生代数错误，且无法自我校验。

## What Changes

- 新增 `POST /api/math/calculate`，接收 LaTeX 表达式字符串，返回 SymPy 计算结果（LaTeX 格式 + 中间步骤）。
- 新增 `scripts/math-calc/calc.py`，用受限命名空间的 SymPy 做符号计算，支持 `simplify`、`expand`、`factor`、`apart`、`diff`、`integrate`、`laplace`、`inverse_laplace`。
- 在 KAQ 的 `KONLING_TOOL_REGISTRY` 与 generic-chat `permittedTools` 中注册 `calculate` 工具，LLM 在 formula-derivation 意图下可主动调用。
- API 强制登录校验，表达式做长度与字符白名单校验，子进程设置 CPU 与并发限制。
- 生产镜像固定安装 `sympy==1.13.3`，并在构建与启动时验证依赖。

## Capabilities

### New Capabilities

- `kaq-formula-derivation`: 为 KAQ formula-derivation 提供 SymPy 真实符号计算能力与受治理的执行边界。

## Impact

- 影响 `src/lib/konling-agent-runtime.ts` 的 KAQ 工具注册与运行时。
- 新增 `src/app/api/math/calculate` API 路由与 `src/lib/math-calc.ts` 共享执行器。
- 影响 `Dockerfile` 与 `docker-entrypoint.sh` 的生产依赖交付。
- 不修改 Prisma schema、Arena 评价器或公式渲染语义。
