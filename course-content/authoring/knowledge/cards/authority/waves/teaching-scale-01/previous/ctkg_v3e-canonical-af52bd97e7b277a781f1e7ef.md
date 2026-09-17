---
node_id: ctkg_v3e-canonical-af52bd97e7b277a781f1e7ef
authority_entity_id: "ctkg:v3e-canonical-af52bd97e7b277a781f1e7ef"
name: "直流增益"
name_en: "DC Gain"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "2-1"
  - "3-7"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/lessons/2-1/design/2-1-handout.md
  - course-content/authoring/lessons/3-7/design/3-7-handout.md
asset_refs: []
---

## 首页

# 直流增益 | DC Gain

**一句话定义**：直流增益是传递函数在零频率处的值 $G(0)$。

**核心直觉**：稳定通道的直流增益决定常值输入与最终输出的比例。

---

## 详情

### 完整解释

若 $G(s)$ 在 $s=0$ 处有有限值，则定义直流增益为

$$
K_{\mathrm{DC}}=G(0).
$$

对稳定的线性定常输入输出通道，零初始条件下施加幅值为 $U_0$ 的阶跃，且满足终值定理条件时，输出终值为 $y(\infty)=G(0)U_0$。这一结论描述持续输入经过动态过程之后的最终比例。

### 归一化输入示例

取 $G(s)=2/(s+4)$，则 $G(0)=0.5$。幅值为 $3$ 的常值输入对应输出终值 $1.5$。分母中的动态项决定到达该终值的过程，$G(0)$ 本身不描述响应快慢。

### 增益的适用范围

含有积分环节的通道可能没有有限的直流增益；不稳定通道即使代入 $s=0$ 得到有限代数值，输出也可能不收敛。单位反馈误差计算还应区分开环低频增益、闭环直流增益以及扰动通道增益。

### 关联节点

静态增益 · 终值定理 · 稳态误差 · 低频响应
