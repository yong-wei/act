## Why

控灵在 Qwen3.5 工具调用路径上执行 `calculate` 时会出现长时间挂起，导致数学问答超时或前端会话异常。现有 SymPy 子进程也不符合教师指定的 Mathematica 计算引擎要求，因此需要把真实计算前移到服务端并改用 Wolfram Engine。

## What Changes

- **BREAKING** 将受治理公式计算后端从 Python/SymPy 切换为 `wolframscript` 执行的 Wolfram Language 脚本，并把超时调整为 30 秒、共享并发上限调整为 1。
- 保持 `/api/math/calculate` 与 `runMathCalculate` 的请求、响应、鉴权和错误投影契约不变。
- 新增控灵数学请求检测、操作推断和服务端预计算，将可信计算结果注入模型上下文。
- 控灵聊天请求不再向模型暴露 `calculate` 工具；无法识别或计算失败时回退为普通问答，不触发模型数学工具调用。
- 新增 Wolfram 脚本回归、预计算单元测试和安装/激活验证说明。

## Capabilities

### New Capabilities

- `konling-math-precompute`: 控灵在调用语言模型前识别数学请求、执行受治理计算并注入可信结果的行为契约。

### Modified Capabilities

- `kaq-formula-derivation`: 将计算引擎、资源边界和控灵调用方式从 SymPy 模型工具调用改为 Wolfram 服务端预计算。

## Impact

- 代码：`scripts/math-calc/`、`src/lib/math-calc.ts`、新增 `src/lib/konling-math-precompute.ts`、`src/app/api/ai/chat/route.ts` 及相关测试。
- 运行环境：生产镜像内供给 Wolfram Engine 可执行运行时；激活凭据由运行环境 secret 或预激活 licensing 卷提供，`wolframscript` 缺失、未激活或无法执行 `calc.wls` 时部署必须失败关闭。
- 外部依赖：个人/教学用途可使用免费 Wolfram Engine；商用部署需要匹配的 Wolfram 授权。
- API 与前端：现有数学计算 API 和控灵前端契约不变。

## Tracking

- 本变更是历史 SymPy 能力来源 [#1154](https://github.com/yong-wei/act/issues/1154) 的 follow-up；唯一追踪 Issue 已登记为 [#1496](https://github.com/yong-wei/act/issues/1496)，PR #1484 已通过 `Closes #1496` 关联，合并时自动关闭该 Issue。
