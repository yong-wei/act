 ---
 status: proposed
 context: kaq-formula-derivation
 seq: 0046
 ---

 # 使用 Next.js API 路由 + SymPy 子进程作为公式推导引擎

 采用 Next.js API 路由通过子进程调用 Python SymPy 脚本的方式，为 KA-Q 系统提供学生侧的公式推导能力，而不引入独立的微服务或重写符号数学引擎。

 ## 背景

 自动控制原理课程中，学生需要在互动学习过程中查看拉普拉斯变换和传递函数化简的逐步推导过程。这些推导涉及符号数学运算，需要可靠的计算机代数系统支持。项目已有 `mathjs`（JS 符号库）和 `katex`（LaTeX 渲染）依赖，但 `mathjs` 不支持拉普拉斯变换这类积分变换的直接计算。

 ## 考虑过的方案

 - **独立 Python 微服务**：将 SymPy 封装为独立 HTTP 服务。引入新的部署组件和运维负担，增加请求延迟，在推导请求量不大的场景下过度设计。
 - **Rust/JS 手写推导逻辑**：在前端或 Rust 内核中手写拉普拉斯变换规则。维护成本高、易遗漏边界情况，且重复实现 SymPy 已完备的功能。
 - **直接在前端浏览器中运行 SymPy（Pyodide/WASM）**：增加客户端体积和加载延迟，SymPy 在 WASM 环境下的兼容性和性能不可靠。
 - **Next.js API 路由 + `child_process` 调用 SymPy**（选定）：利用已有 Node 运行时，通过 API 路由编排对 Python 子进程的调用。部署时只需在服务器上安装 Python + SymPy，不增加额外服务。适用于推导请求频率较低、响应延迟可接受的场景。

 ## 决策

 1. 推导逻辑以独立 Python 脚本编写，使用 SymPy 的 `laplace_transform`、`simplify`、`apart`（部分分式展开）等函数。
 2. Next.js API 路由接收客户端请求，通过 `child_process.execFile` 调用 Python 脚本。
 3. Python 脚本接收 stdin JSON 输入，输出 stdout JSON 结果；失败时通过 stderr 和退出码传递错误信息。
 4. API 路由对结果做类型校验（Zod schema）后返回给客户端。
 5. 推导结果包含步骤序列（每步含 LaTeX 表达式），前端通过 `react-katex` 渲染。

 ## 后果

 - 推导 API 在每个请求上 fork 子进程，延迟约 200–500ms，不适合高频调用。可通过结果缓存（Redis/内存）缓解。
 - 生产环境必须安装 Python 3.11+ 和 SymPy。项目已有 `python3` 依赖（用于教材导出等脚本），不新增部署依赖。
 - 子进程安全性：推导输入应做严格的模式校验和超时控制，避免恶意表达式导致的资源耗尽。
 - 后续可分离为独立 worker（如 BullMQ）以支持队列和重试，API 路由保持不变。
 - 本决策不改变 Arena 模型选择器中的公式渲染行为（由 `arena-model-formula-rendering` spec 覆盖）。
