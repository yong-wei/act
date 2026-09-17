---
node_id: m1r-v1d_object_aa8ae205a38e3698addb8fde
authority_entity_id: "m1r-v1d:object:aa8ae205a38e3698addb8fde"
name: "鲁棒性仿真方法"
name_en: "Simulation-Based Robustness Assessment"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
consevent_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8332621f348dd4a3e9294a8443f91191aabab3299b9b106845cf7c72a4541274.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8332621f348dd4a3e9294a8443f91191aabab3299b9b106845cf7c72a4541274.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-12a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 鲁棒性仿真方法 | Simulation-Based Robustness Assessment

一句话定义：鲁棒性仿真通过有计划地改变模型和输入条件寻找失败情形、检查实现，并明确区分样本证据与全范围保证。

- 仿真场景应来自声明的不确定集合。
- 一个合格反例足以否定全族声明。
- 有限样本全部通过通常不能证明全族成立。

---
## 详情
### 完整解释

鲁棒性仿真需要先定义对象集合、控制器、输入、初态和指标，再选择参数场景。边界场景、相关参数组合、动态扰动及实际实现限制都可能重要。缺少集合定义时，增加仿真次数也无法说明究竟覆盖了什么。

仿真适合发现反例、核对模型与实现，或帮助定位最坏工况。若希望从有限计算得出严格的全范围结论，还需要单调性、解析界或适用定理等依据。不能把“没有在样本中看到失败”改写为“所有允许对象都不可能失败”。

### 教学计算/推理例

考虑已经给定的闭环族

$$
\dot x=(1/4-\theta^2)x,\qquad x(0)=1,
\qquad -1\leq\theta\leq1,
$$

其中θ是未知但固定的参数。若只仿真两个端点θ=±1，状态都满足 $x(t)=e^{-3t/4}$，在t=4时约0.04979，看起来衰减良好。

但允许的中点θ=0给出 $x(t)=e^{t/4}$，t=4时约2.71828，状态持续增长。两个端点都稳定，并不能代表这个非单调参数族整体稳定；一个允许的中点反例已经足以否定全族稳定声明。

直接检查系数还可得到完整分类：当 $|\theta|>1/2$ 时系数为负，状态衰减；小于1/2时系数为正，状态增长；等于1/2时系数为零，非零状态保持常数而不趋于零。这个解析分类补充了仿真证据，不能与“只查三个样本”混为一谈。

### 核验仿真本身

本例可以用解析解检验数值求解器：初始状态应为1，轨迹导数应满足原方程，t=4处数值应与指数解一致。这样可以区分模型真的存在不稳定情形，与步长或代码错误造成的假象。

对于更复杂系统，应检查数值容差、求解方法、事件处理和仿真时长是否足以支撑指标。短时间内状态变化很小，既可能是缓慢稳定，也可能是缓慢不稳定，不能仅凭图像看似平坦就判定长期性质。

### 场景选择与记录

端点和名义点有价值，但不应成为唯一默认选择。参数进入模型的方式、关联约束和已知敏感区域会影响场景设计。本例的θ平方结构直接提示内部点可能更危险，因此需要把这种结构纳入检查。

若采用随机采样，应记录采样分布、样本范围和随机种子，并说明统计结论的口径。没有给定分布时，不能把确定性参数区间自动转换成“某个失败概率”；即使有概率估计，它也与全称鲁棒保证不同。

### 适用条件与边界

仿真只覆盖所建模的物理与控制条件。遗漏饱和、延迟或不稳定动态时，仿真通过不能证明真实实现也满足要求。应说明哪些模型变化已纳入，哪些仍未覆盖，避免把工具成功运行当作系统正确的证明。

本例证明了该声明集合不鲁棒稳定，但不意味着所有端点检查都无效。若另一个模型具有能保证最坏点位于端点的结构，并已证明这一性质，端点验证就可能充分。关键是依据，而不是固定测试点数量。

### 常见误区

1. 端点全部通过就无条件认定参数内部也通过。
2. 短时曲线平坦就判定长期稳定。
3. 不记录采样分布却报告具有概率含义的可靠性。

### 自检

1. 本例哪个允许参数足以否定全族稳定？
2. 仿真与解析解交叉核验能够排除哪类误判？

**核对要点**：θ=0；它能帮助发现数值或实现错误，避免把求解器失真当成真实动态结论。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
