---
node_id: ctc_modeling-8aa475ed6514adc11f9b5c8d
authority_entity_id: "ctc:modeling-8aa475ed6514adc11f9b5c8d"
name: "动态控制系统"
name_en: "Dynamic Control System"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-6fea919b5360ed78fb8d27a4db75a629c68cd47fbedb14e532f10bc2f7bbc4e3.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-6fea919b5360ed78fb8d27a4db75a629c68cd47fbedb14e532f10bc2f7bbc4e3.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctc_modeling-8aa475ed6514adc11f9b5c8d.md"
asset_refs: []
---

## 首页

# 动态控制系统 | Dynamic Control System

**一句话定义**：由相互制约的部分组成、其重要变量随时间变化的控制整体。

**核心直觉**：先看系统边界和变量之间的动态作用，再选择某一种数学表示。

**关键公式**：
$$
\dot x=f(x,u,t),\qquad y=g(x,u,t)
$$

**学习目标**：识别动态系统的边界、输入输出和状态，并区分系统概念与具体模型。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

动态控制系统强调“由哪些部分组成以及怎样演化”，比某一条微分方程更上位。被控对象、控制器、执行器和传感器可以共同构成一个闭环动态系统；同一系统也可在不同层级拆成子系统。重划边界后，原先的内部信号可能成为子系统输入，但相同物理连接和初始条件下的真实运动不会因此改变。状态记录影响未来演化的内部信息，输出则是所关心或能够测量的量，二者不必相同。

### 教学计算/推理例

设液位槽横截面积 $A=2\ \mathrm{m^2}$，流入与流出差为 $0.1\ \mathrm{m^3/s}$。由 $A\dot h=q_{in}-q_{out}$ 得 $\dot h=0.05\ \mathrm{m/s}$；这是系统在该时刻的动态变化率。

### 适用条件与边界

计算只说明局部变化率，假设截面积不变且流量单位一致。当前权威邻域只返回该节点本身，因此不虚构直接图谱关系；具体组成关系应以更细的系统图或已审模型为准。

### 自检

1. 动态系统的“状态”一定等于输出吗？
2. 保持控制器与对象的物理连接不变，只把建模边界缩小到被控对象，整个闭环的物理行为会改变吗？

**核对要点**：不一定，状态可包含不能直接测量的内部变量；不会，仅重划建模边界不会改变实际互连。改变的是被分析子系统的输入、输出及模型；实际断开或移除控制器才可能改变物理闭环行为。

### 关联节点

- 当前权威邻域仅返回该节点本身，未添加推测关系。
