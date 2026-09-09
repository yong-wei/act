---
node_id: ctkg_v3e-canonical-16ddaebf2fe19d65ecc35886
authority_entity_id: "ctkg:v3e-canonical-16ddaebf2fe19d65ecc35886"
name: "自然响应"
name_en: "Natural Response"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "3-1"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/knowledge/cards/nodes/零输入响应_2_ee4b953b.md
  - course-content/authoring/lessons/3-1/design/3-1-handout.md
asset_refs: []
---

## 首页

# 自然响应 | Natural Response

**一句话定义**：自然响应由系统自身的动态模态构成，反映初始储能的演化。

**核心直觉**：极点决定模态怎样变化，初始条件决定各模态被激发的程度。

---

## 详情

### 完整解释

自然响应是系统齐次动态方程的解。以零输入状态方程为例，

$$
\dot x(t)=Ax(t),\qquad x(t)=e^{At}x(0).
$$

输出中的自然响应为 $y_n(t)=Ce^{At}x(0)$。负实极点产生衰减指数项，共轭复极点产生振荡模态，重根还会带来时间的多项式因子。极点实部决定衰减或增长，初始状态及输出通道共同决定模态幅值。

一般输入作用下，总响应可分为零输入响应和零状态响应。零状态响应中也可能出现系统极点对应的瞬态项，因此“出现某个系统极点”与“该项完全由初始条件引起”应区分。

### 回位模态示例

若舵机的一个误差模态满足 $\dot z=-0.5z$，且 $z(0)=2$，则

$$
z(t)=2e^{-0.5t},\qquad z(2)\approx0.736.
$$

误差幅值逐渐衰减；衰减速度来自极点 $-0.5$，初始幅值来自 $z(0)$。

### 关联节点

零输入响应 · 初始条件 · 极点 · 系统模态
