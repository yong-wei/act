---
node_id: ctkg_v3e-object-aa79b6fedda690cfd68855aa
authority_entity_id: "ctkg:v3e-object-aa79b6fedda690cfd68855aa"
name: "继电器非线性"
name_en: "Relay Nonlinearity"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "5-1"
  - "5-2"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/lessons/5-1/design/5-1-handout.md
  - course-content/authoring/lessons/5-2/design/5-2-handout.md
asset_refs: []
---

## 首页

# 继电器非线性 | Relay Nonlinearity

**一句话定义**：理想继电器依据输入符号切换输出状态，形成不连续的非线性关系。

**核心直觉**：继电器输出的幅值由开关状态决定，微小输入也可能触发完整切换。

---

## 详情

### 完整解释

理想对称继电器常用下式描述：

$$
u=M\operatorname{sgn}(v).
$$

当 $v>0$ 时输出为 $M$，当 $v<0$ 时输出为 $-M$；切换点的取值需按具体模型约定。它不具有零点附近的小幅比例关系。例如 $M=2$ 时，$v=0.3$ 对应 $u=2$，$v=-0.1$ 对应 $u=-2$。

### 带滞环的切换

带滞环继电器使用两个阈值：输入上行达到 $+\Delta$ 时切换到正输出，下行达到 $-\Delta$ 时切换到负输出。在两个阈值之间，输出保留原状态。因此，同一输入值可能对应不同输出，具体取决于先前的运动方向和状态。

继电器可近似描述开关式执行机构和控制逻辑。滞环有助于减少噪声导致的频繁切换，同时引入记忆效应。分析闭环中的持续振荡时，需要结合对象动态；描述函数提供近似判断，时间响应和具体非线性模型用于进一步核验。

### 关联节点

开关控制 · 滞环 · 非线性系统 · 描述函数
