## Why

当前 Authority 图谱直接以数千个工程对象作为入口，保留了机器可追溯性，却没有稳定的人类导航层。需要建立经过审核的领域展示目录，使用户先理解知识版图，再进入真实工程对象与教学关系，同时不把展示分组伪装成 Authority 事实。

## What Changes

- 建立版本化的八领域展示目录：系统建模、时域分析、稳定性分析、频域分析、根轨迹、经典控制设计、离散时间控制分析、状态空间控制分析与设计。
- 将控制理论综合组件定义为全局汇总入口，而非与八个领域并列的第九领域。
- 允许一个工程对象属于多个领域；成员资格是展示投影，不写回 ActKG Engineering Authority。
- 为领域名称、摘要、排序、视觉角色与入口统计建立可审核、可校验的产品投影，禁止向用户暴露对象标识、版本哈希或原始枚举。
- 明确领域目录缺项、未知类型和跨领域对象的受控呈现，不凭名称相似度即时猜测归属。

## Capabilities

### New Capabilities
- `authority-domain-display-catalog`: 定义 Authority 人类导航领域、成员关系、汇总入口与版本化审核合同。

### Modified Capabilities
- `active-authority-semantic-graph-presentation`: 允许明确标识的展示导航节点先于真实 Authority 对象出现，同时禁止将展示节点或汇总边表达为工程事实。
- `resource-node-knowledge-workspace-ui`: 以经过审核的多对多领域目录替代单一推断归属，并保持领域入口的渐进加载合同。

## Impact

影响 Authority 图谱投影生成、领域目录工件、根级接口、工作区导航与治理测试；不修改 ActKG 对象、关系、选择器或生产 Authority 身份。
