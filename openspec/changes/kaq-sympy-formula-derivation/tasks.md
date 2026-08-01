## 1. SymPy 计算后端

- [x] 1.1 新增 `scripts/math-calc/calc.py`，支持化简、展开、因式分解、部分分式、求导、积分、拉普拉斯变换与逆变换。
- [x] 1.2 在 `scripts/math-calc/requirements.txt` 固定 SymPy 与 ANTLR LaTeX 解析运行时版本。
- [x] 1.3 使用受限解析：字符白名单、长度上限、`__builtins__` 置空的命名空间，优先 `parse_latex`，回退受限 `parse_expr`。

## 2. API 路由与共享执行器

- [x] 2.1 新增 `src/lib/math-calc.ts`，统一封装白名单校验、4 并发 + 8 排队、10 秒超时与结构化结果解析。
- [x] 2.2 新增 `POST /api/math/calculate`，强制登录、Zod 校验并将共享执行器容量错误投影为 429。
- [x] 2.3 覆盖 401/400/200/422/503/429、非法字符不进入执行器及共享并发限制测试。

## 3. KAQ 工具集成

- [x] 3.1 在 `KonlingToolName`、`KONLING_TOOL_REGISTRY`、`DEFAULT_TOOLS` 与 generic-chat `permittedTools` 中注册 `calculate`。
- [x] 3.2 在 `buildKonlingToolRuntime` 与 `buildScopedKonlingAiTools` 暴露 `calculate` 工具。
- [x] 3.3 为工具注册、执行与共享容量错误投影补充 `konling-agent-runtime` 测试。

## 4. 生产依赖与文档

- [x] 4.1 Dockerfile 安装固定 Python 依赖，runner 阶段执行 `py_compile` 与真实 LaTeX 解析探针；entrypoint 重复检查解析能力。
- [x] 4.2 更新 ADR 0046 与 `kaq-formula-derivation` CONTEXT。
- [x] 4.3 移除错误的 `/api/interactive/formula-derivation` 旧实现。

## 5. 验证

- [x] 5.1 运行 `tsc --noEmit`、新增 route 测试与 `konling-agent-runtime` 测试。
- [x] 5.2 运行 `git diff --check`。
