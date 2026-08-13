## Why

根轨迹、频域分析与经典控制设计之间存在清晰的教学依赖和方法应用关系，而当前投影不足以支持领域内的学习顺序浏览。需要以独立增量包补充经典控制领域教学语义。

## What Changes

- 审核并发布根轨迹、频域分析、经典控制设计三个领域的核心教学节点与直接先修/后修关系。
- 区分教学顺序与工程上的推导、应用、分析关系，禁止把工程谓词自动改写为先修关系。
- 对未覆盖对象保留非阻断的部分覆盖状态。
- 生成可独立版本化、验证和回滚的经典控制教学分片。

## Capabilities

### New Capabilities
- `classical-domain-teaching-semantics`: 定义根轨迹、频域分析与经典控制设计的已审核增量教学语义包。

### Modified Capabilities
- `act-teaching-prerequisites`: 增加三个经典控制领域的直接、已发布先修关系及其审核不变量。

## Impact

影响 Teaching Projection 作者态关系、审核队列、运行态分片和内容验证；不改变 Engineering Authority、课程运行时或前端组件。
