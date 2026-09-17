---
node_id: ctkg_v3e-object-c3d7e85e2b60c3320db8a44a
authority_entity_id: "ctkg:v3e-object-c3d7e85e2b60c3320db8a44a"
name: "量化误差"
name_en: "Quantization error"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "5-1"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/knowledge/cards/nodes/量化_7_6cb6511b.md
  - course-content/authoring/lessons/5-1/design/5-1-handout.md
asset_refs: []
---

## 首页

# 量化误差 | Quantization error

**一句话定义**：连续幅值或高精度数值被映射到有限分辨率的离散等级时，量化值与原值之间的差。

**核心直觉**：幅值只能落在有限档位上，细小变化可能暂时看不出来。

---

## 详情

### 完整解释

设量化步长为 $q>0$。在不发生溢出或饱和的范围内，最近邻均匀量化可写为

$$
Q(x)=q\,\operatorname{round}(x/q),\qquad e_q=Q(x)-x.
$$

每个输入被映射到最近的量化等级，因此

$$
|e_q|\le\frac q2.
$$

这一界限依赖最近邻舍入和未饱和条件。截断量化、非均匀量化或量程之外的输入需要按各自规则分析。

### 数值示例

取 $q=0.1$、$x=0.26$，量化值为 $0.3$，误差为 $0.04$，小于半个量化步长 $0.05$。增大量化分辨率、减小步长，可以降低这一幅值误差界限。

### 控制中的影响

传感器、A/D 转换及数字控制运算都可能引入量化误差。它会使连续的小幅调节变成台阶变化；在某些闭环条件下还可能与其他非线性共同形成极限环。将误差近似为随机噪声需要额外统计假设。
