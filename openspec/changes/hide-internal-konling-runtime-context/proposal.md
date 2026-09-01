## Why

`/api/ai/konling-context` 当前向学生浏览器返回完整控灵运行上下文，包括学习画像、计划、知识工作区、教学投影、双域来源、私有记忆、允许工具和缺失上下文。生产前端未使用该接口，但任何已认证学生都可以读取内部诊断与记忆结构，违反控灵私有上下文只留服务端的既有合同。

## What Changes

- 废弃学生可读的完整 Konling runtime DTO，或将必需场景改为显式最小的学生安全投影。
- 从浏览器响应中排除私有记忆、内部 provenance、工具权限、缺失原因代码和运行时诊断。
- 将调试和测试需求改为服务端边界验证，不依赖生产公开诊断接口。
- 增加认证原始响应回归，使内部 canary 值在模型调用中可用、在学生响应中不可达。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `konling-agent-runtime`: 所有学生可读的控灵上下文端点必须在服务端完成最小安全投影。

## Impact

- Affected API: `src/app/api/ai/konling-context/route.ts`.
- Affected runtime projection and tests: Konling context builders and route-level response coverage.
- No change to server-side model grounding, private memory retention, learner-state computation, or official records.

