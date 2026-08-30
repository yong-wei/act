## 1. 脚本注入与输出解析

- [x] 1.1 `buildCalcWlsCloudProgram` 注入前归一化 CRLF 行尾；验证 `npx vitest run src/lib/__tests__/wolfram-cloud-mcp.test.ts` 覆盖 CRLF 输入用例
- [x] 1.2 `unwrapWolframEvaluatorText` 兼容 `During evaluation of In[n]:=` 前缀与尾随 kernel 消息；验证新增单测通过且既有 `Out[n]=` 行为不变
- [x] 1.3 `math-calc` 集成解析真实 Cloud 输出形态；验证 `src/lib/__tests__/math-calc.test.ts` 新增用例通过

## 2. Cloud 调用重试

- [x] 2.1 `evaluateWolframLanguage` 对非超时、非取消失败整体重试一轮并受预算约束；验证断线重试单测通过

## 3. 端到端验证

- [x] 3.1 相关单测全量通过（wolfram-cloud-mcp / math-calc / konling-math-precompute）
- [x] 3.2 真实 Wolfram Cloud 计算 smoke：laplace / diff / apart / inverse_laplace / factor 均返回结果与步骤
- [x] 3.3 控灵端到端：回答首行包含“结果与关键中间式已由 Wolfram Engine 计算或验证”且带四章节结构
