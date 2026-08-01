## Context

KAQ 运行时（`src/lib/konling-agent-runtime.ts`）通过 `KONLING_TOOL_REGISTRY` 和 mode `permittedTools` 暴露工具给 LLM。formula-derivation 是 generic-chat 中分类出的回答意图，此前只有文本生成，没有真实计算路径。项目已有 `mathjs`（不支持拉普拉斯变换）和 `katex`（渲染），需要新增 SymPy 计算后端。

## Goals / Non-Goals

**Goals:**

- 为 LLM 暴露 `calculate(expression: string) -> string` 工具，底层返回 SymPy 的 LaTeX 结果与中间步骤。
- 新增可由 API 直调的 `POST /api/math/calculate`。
- 让公式推导关键步骤具备可核验的真实结果，同时控制子进程执行风险。
- 在生产镜像内交付可验证的 Python + SymPy 依赖。

**Non-Goals:**

- 不做验证回注循环（LLM 主动调用即可，不强校验）。
- 不做逐步骤定位、不做常驻 worker。
- 不需要 LLM 输出 `===VERIFY===` 标记。
- 不改变 Arena 模型选择器中的公式渲染行为。

## Decisions

### API 路由 + SymPy 子进程

采用 `POST /api/math/calculate` 编排对 `scripts/math-calc/calc.py` 的子进程调用，而不是独立微服务或前端 WASM。请求频率低、延迟 200–500ms 可接受，部署只需在镜像内固定 Python + SymPy。

### 共享执行器避免回环

`src/lib/math-calc.ts` 是 API 与 KAQ `calculate` 工具共用的执行入口，避免工具通过 HTTP 回调自身 API 造成的回环、超时和逻辑漂移。

### 受限解析与资源边界

表达式只允许 ASCII 数学字符且长度 ≤300，变量只允许 ASCII 标识符；TypeScript 在 `spawn` 前执行与 Python 一致的白名单校验。Python 按输入格式确定性分流：含反斜杠或花括号等明确 LaTeX 标记的输入只调用 `parse_latex(strict=True)`，否则只调用使用最小安全全局构造器的受限 `parse_expr`，两种格式之间禁止回退；`parse_expr` 的 transformations 不重复添加 `auto_symbol`，且 `__builtins__` 仍为空。Python 进程内设置 `RLIMIT_CPU`；API 侧 4 并发 + 8 排队，超限 429；子进程 10 秒超时。每个步骤固定包含 `step`、`description`、`operation`、`input`、`output` 五字段。

### 工具权限为 analyze

`calculate` 是只读计算工具，permission tier 为 `analyze`，approval 与幂等策略为 `none`，不进入写工具审批链。

## Risks / Trade-offs

- [子进程每个请求 fork，CPU 与内存成本] → 并发限制、排队上限、CPU 时间限制和超时兜底。
- [`parse_expr` 仍可能被属性链利用] → 字符白名单禁用下划线/引号/分号，命名空间无内建函数，优先 `parse_latex`。
- [生产镜像缺 Python/SymPy] → Dockerfile 固定安装并断言版本，entrypoint 启动检查，API 在缺失时返回 503。

## Migration Plan

无数据库迁移。旧分支上的 `/api/interactive/formula-derivation` 实现被删除，服务端 API 路径以 `/api/math/calculate` 为准。已部署环境需重新构建镜像以获得 SymPy 依赖。

## Open Questions

无。
