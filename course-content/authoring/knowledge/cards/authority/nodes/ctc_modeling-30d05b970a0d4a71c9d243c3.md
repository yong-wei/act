---
node_id: ctc_modeling-30d05b970a0d4a71c9d243c3
authority_entity_id: "ctc:modeling-30d05b970a0d4a71c9d243c3"
name: "仿真保真度级别"
name_en: "Simulation Fidelity Levels"
category: 概念性
knowledge_type: C
bloom_level: 分析
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8a5393ef30a608f0609aad651293454aef31900e59818878eae336bd0111804e.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8a5393ef30a608f0609aad651293454aef31900e59818878eae336bd0111804e.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-01a/previous/ctc_modeling-30d05b970a0d4a71c9d243c3.md"
asset_refs: []
---

## 首页

# 仿真保真度级别 | Simulation Fidelity Levels

**一句话定义**：模型在目标频带、瞬态和物理细节上保留多少与任务有关的动态信息。

**核心直觉**：保真度不是越高越好，而是看被删去的动态是否会影响当前要回答的问题。

**关键公式**：
$$
G_d(s)=\frac{1}{(s+1)(0.05s+1)},\qquad G_r(s)=\frac{1}{s+1}.
$$

**学习目标**：能用瞬态和频域证据判断简化模型在哪些范围内足够，以及何时必须保留快动态。

---

## 详情

### 完整解释

仿真保真度描述模型为任务保留了多少动态，而不是给模型贴上绝对的“真实”或“虚假”标签。详细模型
$$
G_d(s)=\frac{1}{(s+1)(0.05s+1)}
$$
比简化模型
$$
G_r(s)=\frac{1}{s+1}
$$
多出一个时间常数为 $0.05$ 秒的快动态。两者都可用于单位阶跃、频率响应或控制设计的比较，但适用范围不同。零初态单位阶跃下，详细模型的响应为
$$
y_d(t)=1-\frac{20e^{-t}-e^{-20t}}{19},
$$
简化模型的响应为 $y_r(t)=1-e^{-t}$。详细模型在 $t=0^+$ 的初始斜率为 $0$，简化模型的初始斜率为 $1$；快动态改变了刚开始的形状，不能由慢时间常数单独说明。

频域比较要明确角频率 $\omega$ 的单位为 $\mathrm{rad/s}$。两模型的复比值为
$$
\frac{G_d(j\omega)}{G_r(j\omega)}=\frac{1}{1+0.05j\omega}.
$$
在 $\omega=0.2\ \mathrm{rad/s}$ 时，幅值比为 $0.999950$，附加相位约为 $-0.572939^\circ$，所以在这个低频关注范围内简化模型很接近详细模型。在 $\omega=20\ \mathrm{rad/s}$ 时，幅值比降为 $0.707107$，附加相位为 $-45^\circ$，快动态已经明显影响幅值和相位。幅值比只是复比值的模，不能把它当成完整的复误差。

### 教学计算/推理例

先比较两个频点，再决定保真度。若任务只关心 $0.2\ \mathrm{rad/s}$ 附近的慢变化，$0.999950$ 的幅值比和 $-0.572939^\circ$ 的附加相位支持使用简化模型；若任务涉及 $20\ \mathrm{rad/s}$ 附近的快速变化，$0.707107$ 和 $-45^\circ$ 已不能忽略。若任务关心启动瞬间，还应检查初始斜率：详细模型为 $0$，简化模型为 $1$。同一个模型在不同问题上可能得出不同的“够用”结论。

### 适用条件与边界

本例只证明两种给定模型之间的差异，不能证明详细模型就是实物真值。比较默认零初态、单位阶跃和理想线性定常模型；改变输入、初始状态、观测量、频带或误差容限后应重新验证。频率必须写清为角频率 $\omega$（$\mathrm{rad/s}$），而且应同时看幅值、相位与瞬态。模型之间的一致性不等于模型与实物的一致性，实物校核仍需要独立数据或实验。

### 常见误区

1. **误区**：保留更多动态的模型在所有任务上都更好。**纠正**：高保真度会增加计算和参数要求；是否足够取决于目标频带、瞬态和验证目的。
2. **误区**：幅值比接近 $1$ 就表示两个模型完全相同。**纠正**：还要检查附加相位、初始斜率和时间域差异；幅值比不是复误差本身。

### 自检

1. 在 $20\ \mathrm{rad/s}$ 处，为什么简化模型不能忽略详细模型的快动态？
2. 如果只研究 $0.2\ \mathrm{rad/s}$ 的慢变化，除了幅值比还应报告什么证据？

**核对要点**：$20\ \mathrm{rad/s}$ 时幅值比为 $0.707107$ 且附加相位为 $-45^\circ$；低频判断还需报告 $-0.572939^\circ$ 的附加相位，并按任务需要检查瞬态。

### 关联节点

- **系统建模简化假设**（无向，关系：相关）
