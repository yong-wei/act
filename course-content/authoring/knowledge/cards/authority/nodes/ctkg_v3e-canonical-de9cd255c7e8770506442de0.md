---
node_id: ctkg_v3e-canonical-de9cd255c7e8770506442de0
authority_entity_id: "ctkg:v3e-canonical-de9cd255c7e8770506442de0"
name: "叠加原理"
name_en: "Superposition Principle"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-2463eb6c0effd7bc4ccf73d1d8ddbbb43239466b831d75d016df537fd163f8e6.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-2463eb6c0effd7bc4ccf73d1d8ddbbb43239466b831d75d016df537fd163f8e6.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01d/previous/ctkg_v3e-canonical-de9cd255c7e8770506442de0.md"
asset_refs: []
---

## 首页

# 叠加原理 | Superposition Principle

**一句话定义**：线性映射对输入的加权和产生相同权重的输出和。

**核心直觉**：把一个复杂激励拆成几个简单激励，分别求解后再组合。

**关键公式**：
$$\mathcal T[\alpha u_1+\beta u_2]=\alpha\mathcal T[u_1]+\beta\mathcal T[u_2].$$

**学习目标**：检验齐次性与可加性，并在动态系统中正确处理初始状态和多个输入通道。

---

## 详情

### 完整解释

叠加包含齐次性和可加性：输入乘常数，输出乘相同常数；两个输入相加，输出也相加。它刻画的是线性，不要求系统时不变。对于动态系统，如果仅把外部输入作为映射的自变量，上述形式适用于零初始状态的响应。固定非零初始状态会增加一份自然响应，使输入到总输出的映射通常成为仿射映射，直接相加会重复计算自然响应。

也可以把初始状态与输入一起作为自变量：线性状态方程的两组解 $(x_{01},u_1,y_1)$ 与 $(x_{02},u_2,y_2)$ 按相同权重组合后，对应初始状态 $\alpha x_{01}+\beta x_{02}$。因此处理方法是“零状态响应相加，再加一份零输入响应”，或把初始状态也一致相加；不能只组合输入而忽略状态。

### 教学计算/推理例

以归一化船速模型 $\dot y+y=u$ 为例。零初始状态下，阶跃输入1与2分别产生 $y_1=1-e^{-t}$、$y_2=2(1-e^{-t})$；组合输入 $2u_1-u_2=0$，组合输出也恒为零，满足原方程。

再将每次试验的初始状态固定为 $y(0)=1$。输入1的总响应为1，输入2的总响应为 $2-e^{-t}$。两响应直接相加为 $3-e^{-t}$，其初始值是2；而初始值仍为1、输入3的真实响应为 $3-2e^{-t}$。在 $t=\ln2$ 时二者分别为2.5和2，这个差异来自重复计算初始状态，不是原微分方程变成了非线性。

若模型改为 $\dot y+y=u^2$，则零状态下输入1与2分别驱动幅值1和4的响应，而输入3驱动幅值9的响应；1加4不等于9。这才是输入非线性导致的叠加失效。船舶执行器饱和、死区或大范围阻力非线性同样会限制线性模型的使用区间。

### 常见误区与边界

1. **误区**：线性系统一定时不变。**纠正**：系数随时间变化的线性方程仍可满足叠加，时间平移性质要另行检验。
2. **误区**：参考与扰动都能直接乘同一个传递函数后相加。**纠正**：可相加的是各自正确通道的输出分量；注入位置不同，传递函数通常不同。

### 自检

1. 为什么两次试验都用初始值1时，不能把两个总响应直接当成同一初值下的组合响应？
2. 零初态映射 $y=3u+2$ 是否满足叠加？

**核对要点**：相加后初始值也变为2；第二问不满足，因为零输入仍输出2，违反齐次性。

### 关联节点

- **线性叠加原理**（关联）：同一线性性质在其他分析场景中的表达，使用时仍须核对输入、输出及初始条件。
- **线性系统与叠加适用性的命题**（适用关系）：本卡补充了动态系统初始状态的处理条件，使该性质能够用于实际初值问题。
