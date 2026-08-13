## Why

系统建模、时域分析与稳定性分析构成课程的基础学习链，但当前已发布 Teaching Projection 仅有极少量直接先修关系。需要在不触碰工程权威的前提下增量补充这三个领域的教学语义。

## What Changes

- 审核并发布三个基础领域的核心教学节点、直接先修/后修关系及必要的领域成员关系。
- 关系仅表达有教学依据的直接依赖，保留来源与审核记录，不生成传递闭包作为新事实。
- 对暂未覆盖的对象保留诚实空白，不将覆盖率不足标记为发布阻断。
- 生成可由增量 Teaching Projection 合并器直接消费的版本化分片与验证证据。

## Capabilities

### New Capabilities
- `foundation-domain-teaching-semantics`: 定义系统建模、时域分析与稳定性分析的已审核增量教学语义包。

### Modified Capabilities

- `act-teaching-prerequisites`: 增加三个基础领域的直接、已发布先修关系及其审核不变量。

## Impact

影响 Teaching Projection 作者态关系、审核队列、运行态分片和内容验证；不改变 Engineering Authority、课程运行时或前端组件。
