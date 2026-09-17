---
node_id: ctkg_v3e-object-17cae71babbbfe193c0124a4
authority_entity_id: "ctkg:v3e-object-17cae71babbbfe193c0124a4"
name: "积分补偿器"
name_en: "Integral Compensator"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-026066555686222528d2d9d0ecd4372475d8fdb19a9cc2b2acf22d188fb35744.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-026066555686222528d2d9d0ecd4372475d8fdb19a9cc2b2acf22d188fb35744.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01g/previous/ctkg_v3e-object-17cae71babbbfe193c0124a4.md"
asset_refs: []
---

## 首页

# 积分补偿器 | Integral Compensator

**一句话定义**：积分补偿器是引入积分作用以累积误差、改善低频稳态性能的一类补偿概念，PI 是其中一种实现。

**核心直觉**：它是上位概念；纯 I 与 PI 都可含积分作用，但稳定性、超调和控制峰值要分别计算。

**关键公式**：
$$
C_I(s)=\frac{K_i}{s},\qquad C_{PI}(s)=K_p+\frac{K_i}{s}.
$$

**学习目标**：区分纯 I 与 PI，理解积分作用和稳定性、约消极点之间的关系。

---

## 详情

### 完整解释

“积分补偿器”在本批图谱中是比纯积分控制器更宽的上位概念：只要补偿结构引入了积分作用，就应先问它是纯 I，还是同时含比例项的 PI。积分在低频提供很强的累积作用，能够消除特定稳定条件下的阶跃稳态误差；它也会增加系统阶次和相位滞后，因而可能引入振荡和超调。

以同一理想线性对象 $G(s)=1/(s+1)$、单位负反馈、零初态和单位阶跃比较两个已验算实现。纯 I 取 $K_p=0,K_i=1$，闭环为 $1/(s^2+s+1)$，极点为 $-0.5\pm j0.8660254037844385$。PI 取 $K_p=1,K_i=1$，未约简特征多项式为 $(s+1)^2$，开环中的对象极点与控制器零点在 $s=-1$ 处发生稳定约消，闭环表现为 $1/(s+1)$。

### 教学计算/推理例

纯 I 的单位阶跃终值为 $1.0000000021336248$，但峰值为 $1.1630330651827194$，峰值控制量为 $1.298435677012138$；这说明零稳态误差与无超调是两件事。PI 稳定约消例的终值为 $0.9999999999868622$，峰值为 $1.0000000000515648$，峰值控制量为 $1.0$。数值接近一的原因来自已验算模型和有限仿真精度，不应把它们推广为所有积分补偿器都无超调。

### 适用条件与边界

上述比较限定于理想线性定常对象、零初态、单位负反馈、单位阶跃和给定参数。频率量 $\omega$ 的单位为 $\mathrm{rad/s}$。稳定约消只在精确模型中成立；对象参数、零点位置或实现误差稍有变化，约消可能不再成立，隐藏的慢模态也可能重新出现。实际测量噪声、饱和和积分累积须另行设计。

### 常见误区

1. **误区**：积分补偿器就是纯 I。**纠正**：PI 已被该上位概念包含；阅读对象时先区分是否存在比例支路。
2. **误区**：稳定约消等于鲁棒地消除了动态。**纠正**：这里的约消依赖精确的 $s=-1$ 因子，只能作为模型内结果，不能替代参数不确定性验证。

### 自检

1. 为什么纯 I 的终值接近一，却仍出现 $1.1630330651827194$ 的峰值？
2. 为什么 PI 的稳定约消例不能直接证明任意 PI 都不会振荡？

**核对要点**：纯 I 的闭环是共轭复极点，产生超调；约消例的根和参数是特定选择，换参数或模型后必须重新求闭环极点。

### 关联节点

- **比例积分控制器**（入边，关系：属于）
- **补偿器**（出边，关系：属于）
- **根轨迹（单参数）**（入边，关系：用于分析）
