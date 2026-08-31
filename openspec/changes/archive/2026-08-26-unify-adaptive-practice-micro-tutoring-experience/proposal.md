## Why

微辅导 v2 的 135 题基线、归因、资源和资格已经落地，但自适应练习页面仍把题目统一显示为“检查节点练习”，并用客户端 `catalogItemId + reviewed` 猜测是否展示微辅导入口。用户看不到真实阶段，未取得 v2 资格的错答也可能看到“开始微辅导”。standalone practice 与路径执行还共用题目/反馈状态。

## What Changes

- 服务端按当前答案返回题目阶段和微辅导资格投影；客户端不得自行推断资格。
- 只有完整匹配已激活 v2 资格的错误答案才显示“开始微辅导”。
- 不可用时区分未覆盖、证据漂移、资源不可用、验证题不可用和访问撤销。
- 页面标题显示真实阶段：常规练习、准备度、检查点、补救或终结验证。
- 隔离 standalone practice 与 path execution 的 session、题目和微辅导状态。
- 为资格不足的 `UNCERTAIN`/未覆盖作答提供重新作答路径，不改写历史证据。

## Capabilities

### New Capabilities

- `student-micro-tutoring-eligibility-projection`: 学生可见的题目阶段与微辅导资格投影。

### Modified Capabilities

- `micro-tutoring-v2-assessment-baseline`: 学生入口必须消费 v2 分母与阶段，不得用客户端宽泛审核状态代替资格。

## Impact

- 修改自适应练习页面、提交答案/下一题 API，以及学生微辅导面板展示条件。
- 复用 v2 归因、资源投影和验证注册表；不改写历史 WrongAnswerAttribution。
- 需要单元测试、页面契约测试和桌面/窄屏浏览器验收。
