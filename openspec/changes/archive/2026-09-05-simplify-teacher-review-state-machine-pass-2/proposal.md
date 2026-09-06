## Why

教师批阅接口已经统一输出 `{ review }`，客户端仍同时猜测多种旧数据形状，并维护重复的编辑状态同步。部分测试只检查这些旧形状和源码字符串，使实现难以继续化简。

## What Changes

- 按现有批阅、打开、保存及队列接口的真实返回值简化客户端转换，删除没有生产来源的字段别名与分支。
- 合并加载和保存后的相同编辑状态更新，减少重复状态和提示分支；保留保存、批准、退回、发布各自的请求语义。
- 删除仅服务旧数据形状和内部写法的测试；必要的覆盖改为真实接口投影、请求和可见行为断言。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `teacher-review-grading-workspace-simplification`：增加真实接口输入、旧测试随实现退役和生产代码净减少的要求。

## Impact

主要涉及 `src/features/assignments/teacher-review-contracts.ts`、`teacher-review-workspace.tsx`、`teacher-review-queue.tsx` 及两个 Assignment 测试目录。现有 Assignment 服务端投影作为输入依据，接口响应、数据库和评分规则保持不变。不合并 Assignment 目录，不新增通用工作台或请求框架。
