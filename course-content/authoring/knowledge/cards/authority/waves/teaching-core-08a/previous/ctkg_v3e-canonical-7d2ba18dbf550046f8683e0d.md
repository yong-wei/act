---
node_id: ctkg_v3e-canonical-7d2ba18dbf550046f8683e0d
authority_entity_id: "ctkg:v3e-canonical-7d2ba18dbf550046f8683e0d"
name: "传输零点"
name_en: "Transmission Zero"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "2-1"
  - "3-3"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/lessons/2-1/design/2-1-handout.md
  - course-content/authoring/lessons/3-3/design/3-3-handout.md
asset_refs: []
---

## 首页

# 传输零点 | Transmission Zero

**一句话定义**：在单输入单输出模型中，传输零点是约简后传递函数分子的零点。

**核心直觉**：极点描述动态模态，零点影响输入经通道传到输出的方式。

---

## 详情

### 完整解释

对已约去分子分母公共因子的单输入单输出传递函数

$$
G(s)=\frac{N(s)}{D(s)},
$$

若 $N(z)=0$ 且 $D(z)\ne0$，则 $z$ 是这一输入输出通道的传输零点。讨论零点前先完成公共因子约简，可以避免把已消去的内部因素当成该通道的零点。

零点会改变响应中不同模态的权重，也会影响频率响应。右半平面零点常伴随反向响应和可实现带宽的限制。闭环设计既要观察极点位置，也要考虑零点所在的位置；仅凭极点相近，不能保证两个模型具有相同的响应形态。

### 代数判断示例

对 $G(s)=(s+1)/(s^2+4s+5)$，在 $s=-1$ 处分子为零、分母为 $2$，所以 $-1$ 是传输零点。这里的零点属于复变量 $s$ 平面，不等同于实频率轴上的某个振荡频率。

### 关联节点

传递函数 · 极点 · 零极点约简 · 非最小相位系统
