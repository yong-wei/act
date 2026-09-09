---
node_id: ctkg_v3e-canonical-23c4127cb1ffab795d290351
authority_entity_id: "ctkg:v3e-canonical-23c4127cb1ffab795d290351"
name: "系统模态"
name_en: "Modes of the system"
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
  - course-content/authoring/knowledge/cards/nodes/模态_2_d586e1e6.md
  - course-content/authoring/lessons/3-1/design/3-1-handout.md
asset_refs: []
---

## 首页

# 系统模态 | Modes of the system

**一句话定义**：系统自由响应中，由特征根及其重数结构决定的基本时间变化形式。

**核心直觉**：各模态描述不同的衰减、增长或振荡过程，总响应由实际被激发、被观测到的分量叠加而成。

---

## 详情

### 极点与时间函数

实特征根 $p=-a$ 对应指数项 $e^{-at}$。共轭特征根 $p=\sigma\pm j\omega$ 对应实数形式

$$
e^{\sigma t}\cos\omega t,\qquad e^{\sigma t}\sin\omega t.
$$

实部决定幅值包络的衰减或增长，虚部决定振荡角频率。对重复根，响应还可能包含 $t^r e^{pt}$；在状态空间描述中，多项式的最高次数由相关 Jordan 块的大小决定。重复特征值本身并不保证出现非零的 $t e^{pt}$ 项。

### 两个衰减模态

若

$$
y_h(t)=e^{-t}+2e^{-3t},
$$

则两个模态都衰减，初始输出为 $3$，最终趋于零。时间足够长时，衰减较慢的 $e^{-t}$ 项占主要地位。模态前的系数由初始条件、输入作用及输出选择决定。

### 判断要点

- 分量的正负不能单独判定稳定性，应检查时间函数是否衰减。
- 输入输出传递函数可能因不可控、不可观或极零消去而不显示某些内部模态。
- 用主导模态近似高阶响应时，还应检查系数大小及所关注的时间范围。
