## Context

本轮用户授权重设计图谱与路径，具体运行证据与资源入口设计见 `../redesign-graph-path-experience/investigation.md` 和 `design.md`。同一快照提供 79 条明确工程 prerequisite，但生产路径只消费资源级先修。原提案要求先把工程边转写为 ACT_TEACHING REQUIRED；本轮取消该中间转换，以保持真实来源。

## Goals / Non-Goals

目标是在现有生产 planLearningPath 内得到正确且可解释的知识先修资源顺序，并保持资源替代、预算与完成状态语义。

不新建规划器，不改上游图谱或历史路径，不产生虚假的教学审核记录，不切换任何生产指针。

## Decisions

1. 服务端加载同一 verified snapshot 的工程直接 prerequisite 与教学资源绑定，保留完整版本引用。其他工程谓词不能推断为先修。
2. 资格过滤与本次排序完成后建立 `canonicalId → eligible resources` 索引。每个尚未满足的前驱是一个 OR 组，选择一个代表资源；同一资源可以覆盖多个前驱。
3. 从本次目标 canonical 开始递归，不为资源顺便覆盖的所有其他知识展开整课依赖。可信完成状态可满足前驱；未知状态不能视为完成。
4. 为已选择代表物化资源 ID 的 AND 依赖，然后把派生 registry 交给既有 repair 与 assembly。实例化前不能把全部候选资源做笛卡尔依赖，实例化后各阶段不能回读原 registry。
5. 解析过程确定性排序并检测环、无可执行前驱和预算不可行。输出 fallback/限制时保留可解释依据，不能宣称违反依赖的路径 ready。
6. 证据包含工程 relation ID、方向、snapshot 与被选资源 binding；教学 RECOMMENDED 边仍按原强度解释。

## Risks / Trade-offs

部分工程端点没有资源绑定，必须如实报告；不能用自动模糊绑定解除阻塞。旧 goal aliases 需要通过已存在资源身份与发布绑定建立精确对应。资源预算较小时，满足先修可能压缩目标资源的选择空间，这是实际学习约束。

## Verification

覆盖多个替代资源、多前驱、共享代表、递归、已完成状态、确定性、环、缺资源和预算。至少一个回归从生产 planLearningPath 入口验证顺序；真实运行数据核对 79 条关系及 same-snapshot。最后运行相关领域、类型、全量验证及有界独立审查。
