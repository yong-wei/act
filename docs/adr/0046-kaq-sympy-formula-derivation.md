---
status: proposed
context: kaq-formula-derivation
seq: 0046
---

# 使用 /api/math/calculate + SymPy 子进程作为 KAQ 公式计算引擎

采用 `POST /api/math/calculate` 通过子进程调用 Python SymPy 脚本的方式，为 KAQ 系统提供真实符号计算能力；LLM 在 formula-derivation 回答意图中通过 `calculate` 工具主动获取中间步骤的真实结果，避免纯文本推导产生代数错误。

## 背景

KAQ 的 formula-derivation 此前完全依赖 LLM 文本生成推导，多项式展开、导数/积分、拉普拉斯变换等环节可能产生代数错误且无法自我校验。Issue #1154 要求为 LLM 暴露 `calculate(expression: string) -> string` 工具，底层调用 SymPy 做符号计算，推导关键步骤时主动调用以获取真实结果。项目已有 `mathjs`（JS 符号库）和 `katex`（LaTeX 渲染）依赖，但 `mathjs` 不支持拉普拉斯变换这类积分变换的直接计算。

## 考虑过的方案

- **独立 Python 微服务**：将 SymPy 封装为独立 HTTP 服务。引入新的部署组件和运维负担，增加请求延迟，在推导请求量不大的场景下过度设计。
- **Rust/JS 手写推导逻辑**：在前端或 Rust 内核中手写拉普拉斯变换规则。维护成本高、易遗漏边界情况，且重复实现 SymPy 已完备的功能。
- **直接在前端浏览器中运行 SymPy（Pyodide/WASM）**：增加客户端体积和加载延迟，SymPy 在 WASM 环境下的兼容性和性能不可靠。
- **Next.js API 路由 + `child_process` 调用 SymPy**（选定）：利用已有 Node 运行时，通过 `POST /api/math/calculate` 编排对 Python 子进程的调用。部署时在镜像内固定安装 Python + SymPy，不增加额外服务。适用于推导请求频率较低、响应延迟可接受的场景。

## 决策

1. 计算逻辑以 `scripts/math-calc/calc.py` 编写，使用 SymPy 的 `laplace_transform`、`simplify`、`apart`、`diff`、`integrate` 等函数，SymPy 版本固定为 `1.13.3`。
2. `POST /api/math/calculate` 接收 LaTeX 表达式字符串，通过 `child_process.spawn` 调用 Python 脚本，返回 LaTeX 结果与中间步骤。
3. Python 脚本接收 stdin JSON 输入，输出 stdout JSON 结果；失败时通过退出码和 JSON error 字段传递错误信息。
4. 同一执行逻辑封装在 `src/lib/math-calc.ts`，API 路由与 KAQ `calculate` 工具共用，避免 HTTP 回环和逻辑漂移。
5. KAQ 运行时的 `KONLING_TOOL_REGISTRY` 与 generic-chat mode 的 `permittedTools` 注册 `calculate`（permission tier 为 analyze），LLM 在 formula-derivation 意图下可主动调用。
6. 安全与资源边界：API 强制登录；共享执行器在启动子进程前完成表达式长度与字符白名单校验；明确 LaTeX 标记只调用 `parse_latex(strict=True)`，纯 SymPy 表达式只调用无内建函数的受限 `parse_expr`，两种格式之间禁止回退；Python 进程内设置 CPU 时间限制；API 与 KAQ 共用 4 并发 + 8 排队限制，超限分别投影为 API 429 与受治理工具错误；子进程 10 秒超时。
7. 推导结果包含步骤序列（每步含 `step`、`description`、`operation`、`input`、`output` 五个字段及 LaTeX 表达式），前端通过 `react-katex` 渲染。

## 后果

- 推导 API 在每个请求上 fork 子进程，延迟约 200–500ms，不适合高频调用。可通过结果缓存（Redis/内存）缓解。
- 生产镜像在 base stage 按 requirements 安装固定版本 `sympy==1.13.3` 与 `antlr4-python3-runtime==4.11.1`，runner 阶段执行 `py_compile`、真实 `calc.py` SymPy/LaTeX 烟测并检查步骤字段，entrypoint 启动时重复检查；`scripts/math-calc` 随 runner 阶段复制进镜像。
- 子进程安全性：共享执行器统一执行长度与字符白名单校验，`parse_expr` 使用受限命名空间（`__builtins__` 置空），并设置 CPU 时间与 API/KAQ 并发限制，避免恶意表达式导致的资源耗尽与治理旁路。
- 不做验证回注循环、逐步骤定位、常驻 worker，也不需要 LLM 输出 `===VERIFY===` 标记；LLM 主动调用即可。
- 后续可分离为独立 worker（如 BullMQ）以支持队列和重试，API 路由保持不变。
- 本决策不改变 Arena 模型选择器中的公式渲染行为（由 `arena-model-formula-rendering` spec 覆盖）。
