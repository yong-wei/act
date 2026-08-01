## 1. SymPy 计算后端

- [x] 1.1 新增 `scripts/math-calc/calc.py`，支持化简、展开、因式分解、部分分式、求导、积分、拉普拉斯变换与逆变换。
- [x] 1.2 固定 `sympy==1.13.3` 与兼容的 `antlr4-python3-runtime==4.11.1` 到 `scripts/math-calc/requirements.txt`。
- [x] 1.3 使用受限解析：字符白名单、长度上限、`__builtins__` 置空的命名空间；明确 LaTeX 标记严格走 `parse_latex(strict=True)`，纯 SymPy 表达式严格走不重复 `auto_symbol` 的受限 `parse_expr`，禁止跨格式回退。

## 2. API 路由与共享执行器

- [x] 2.1 新增 `src/lib/math-calc.ts`，在 `spawn` 前执行与 Python 一致的表达式/变量白名单校验；子进程非零退出投影为稳定 unavailable 错误（不泄露 stderr），封装 10 秒超时与结构化结果解析。
- [x] 2.2 新增 `POST /api/math/calculate`，强制登录、Zod 校验、并发限制（4 并发 + 8 排队，超限 429）。
- [x] 2.3 覆盖 401/400/200/422/503/429 的 route 测试。

## 3. KAQ 工具集成

- [x] 3.1 在 `KonlingToolName`、`KONLING_TOOL_REGISTRY`、`DEFAULT_TOOLS` 与 generic-chat `permittedTools` 中注册 `calculate`。
- [x] 3.2 在 `buildKonlingToolRuntime` 与 `buildScopedKonlingAiTools` 暴露 `calculate` 工具。
- [x] 3.3 为工具注册与执行补充 `konling-agent-runtime` 测试。

## 4. 生产依赖与文档

- [x] 4.1 Dockerfile 安装并断言 `sympy==1.13.3` 与 `antlr4-python3-runtime==4.11.1`，runner 阶段复制 `scripts/math-calc` 并执行真实 SymPy/LaTeX `calc.py` 烟测；entrypoint 检查依赖。
- [x] 4.2 更新 ADR 0046 与 `kaq-formula-derivation` CONTEXT。
- [x] 4.3 移除错误的 `/api/interactive/formula-derivation` 旧实现。

## 5. 验证

- [x] 5.1 运行 `python3 -m py_compile`、`tsc --noEmit`、新增 route 白名单测试与 `konling-agent-runtime` 测试。
- [x] 5.2 运行 `git diff --check`。
- [x] 5.3 运行实际启动 `scripts/math-calc/calc.py` 的 SymPy/LaTeX 回归，覆盖合法格式分流、边界语法错误与非法字符。
