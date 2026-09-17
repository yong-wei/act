---
node_id: ctkg_v3e-object-cfdae92ada72d7710e7f1cee
authority_entity_id: "ctkg:v3e-object-cfdae92ada72d7710e7f1cee"
name: "劳斯-赫尔维茨稳定性判据"
name_en: "Routh-Hurwitz Stability Criterion"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: draft
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-534c1018cbeb1814f101f8adf6aa842eb21c2e3d464055a63edf66ec137a5d68.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-534c1018cbeb1814f101f8adf6aa842eb21c2e3d464055a63edf66ec137a5d68.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-cfdae92ada72d7710e7f1cee.md"
asset_refs: []
---

## 首页

# 劳斯-赫尔维茨稳定性判据 | Routh-Hurwitz Stability Criterion

**一句话定义**：关于连续线性系统特征方程稳定性的充分必要判据。

**核心直觉**：定理给出根分布的条件，劳斯表只是把条件变成方便计算的表示。

**关键公式**：
$$
p(s)=a₀s³+a₁s²+a₂s+a₃:  a₁>0, a₂>0, a₃>0, a₁a₂>a₀a₃
$$

**学习目标**：区分劳斯-赫尔维茨定理、劳斯表算法和其他稳定判据。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

对三阶实系数多项式，系数正且 a₁a₂>a₀a₃ 时全部根在左半平面。更高阶情形由 Hurwitz 行列式或等价劳斯表给出。这个判据讨论连续系统，朱利判据则针对离散单位圆内稳定。

### 教学计算/推理例

p(s)=s³+2s²+3s+4：a₁=2、a₂=3、a₃=4，且 a₁a₂=6>a₀a₃=4，满足三阶条件。它与劳斯表算出的第一列 1,2,1,4 一致。

### 适用条件与边界

要求特征方程系数为实数，并按连续时间稳定定义使用。边界等号表示临界情形，需要进一步检查虚轴根和重数。

### 自检

1. a₁a₂=4、a₀a₃=4 时属于严格稳定吗？
2. 朱利判据和该判据的稳定区域相同吗？

**核对要点**：不属于严格稳定边界；不相同，前者用于连续左半平面，后者用于离散单位圆。

### 关联节点

- **劳斯表**（入边，关系：组成）
- **劳斯表**（出边，关系：包含）
- **稳定性**（出边，关系：相关）
- **劳斯-赫尔维茨判据是线性系统稳定的充分必要判据。**（入边，关系：表示）
- **特征方程**（出边，关系：相关）
