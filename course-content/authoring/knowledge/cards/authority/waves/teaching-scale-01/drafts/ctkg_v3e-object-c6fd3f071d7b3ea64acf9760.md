---
node_id: ctkg_v3e-object-c6fd3f071d7b3ea64acf9760
authority_entity_id: "ctkg:v3e-object-c6fd3f071d7b3ea64acf9760"
name: "劳斯-赫尔维茨稳定性判据法"
name_en: "Routh-Hurwitz Stability Criterion Method"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-0a14658efad1ea54d0ed42acaa4bd45692ddb5b6dff7504209e99192a59922da.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-0a14658efad1ea54d0ed42acaa4bd45692ddb5b6dff7504209e99192a59922da.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-c6fd3f071d7b3ea64acf9760.md"
asset_refs: []
---

## 首页

# 劳斯-赫尔维茨稳定性判据法 | Routh-Hurwitz Stability Criterion Method

**一句话定义**：把特征方程系数排成劳斯表，并由第一列符号判断连续系统稳定性的计算方法。

**核心直觉**：不用显式求根也能从第一列符号变化数出右半平面根。

**关键公式**：
$$
p(s)=a₀sⁿ+…+aₙ;  stability ⇔ first-column entries >0
$$

**学习目标**：按劳斯表逐行计算，并正确识别符号变化和特殊情形。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

劳斯表方法把高阶特征方程变成递推表格。对没有零行或首项为零的普通情形，第一列的符号变化数等于右半平面根数；全部为正才是连续系统稳定的必要充分条件。零行、零首项和参数边界要用专门规则处理。

### 教学计算/推理例

对 p(s)=s³+2s²+3s+4，前两行为 [1,3] 与 [2,4]，第三行首项为 (2×3−1×4)/2=1，末行首项为 4；第一列 1,2,1,4 全正，因此稳定。

### 适用条件与边界

适用于实系数连续时间特征方程。不能把第一列全正直接搬到离散系统，也不能忽略零行等特殊情况。

### 自检

1. 上述三阶多项式第一列有几次符号变化？
2. 首行首项为零时能否照常相除？

**核对要点**：为 0 次；不能，应使用 ε 规则或其他特殊处理。

### 关联节点

- **轴平移法**（入边，关系：相关）
- **劳斯-赫尔维茨判据基于将特征方程的系数排列成阵列**（入边，关系：组成）
- **特征方程**（出边，关系：用于分析）
- **劳斯-赫尔维茨判据是线性系统稳定的充分必要判据。**（出边，关系：相关）
- **稳定性**（出边，关系：用于分析）
