---
node_id: ctkg_v3e-object-7aa500461c5109b7cffd9b19
authority_entity_id: "ctkg:v3e-object-7aa500461c5109b7cffd9b19"
name: "劳斯表"
name_en: "Routh Array"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1a51df377d9b927bc58fcff7467a25459745393954f1c1b9c64aab5f19009335.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1a51df377d9b927bc58fcff7467a25459745393954f1c1b9c64aab5f19009335.json
  - course-content/authoring/knowledge/cards/nodes/劳斯判据_3_e3500ac9.md
asset_refs: []
---

## 首页

# 劳斯表 | Routh Array

**一句话定义**：由连续系统特征多项式系数构造，用第一列符号变化统计右半平面根数的表。

**核心直觉**：不必显式求出每个根，也能判断有没有向右半平面越界。

**关键公式**：
$$
p(s)=a_3s^3+a_2s^2+a_1s+a_0,\qquad b_1=\frac{a_2a_1-a_3a_0}{a_2}.
$$

**学习目标**：完成三阶劳斯表，识别特殊行并把表的结论解释为稳定性判断。

---

## 详情

### 完整解释

#### 先从闭环特征方程开始

劳斯表处理实系数多项式。对于连续闭环系统，应使用闭环特征多项式，而不是直接拿开环分母。先按 $s$ 的降幂排列系数，缺项补零，再将最高次、次高次对应的系数交错放入前两行。

本卡三阶表在 $a_2\ne0$、无特殊行时为：

| 幂次 | 第一列 | 第二列 |
|---|---|---|
| $s^3$ | $a_3$ | $a_1$ |
| $s^2$ | $a_2$ | $a_0$ |
| $s^1$ | $(a_2a_1-a_3a_0)/a_2$ | $0$ |
| $s^0$ | $a_0$ | $0$ |

第一列从上到下每发生一次符号变化，对应一个右半平面根。用于严格稳定判定时，还必须排除虚轴根及特殊边界。

#### 两个教学算例

对 $p_1(s)=s^3+2s^2+3s+4$，第一列为 $1,2,1,4$，没有符号变化；也没有特殊行，故根都在开左半平面。

对 $p_2(s)=s^3+2s^2+s+4$，第一列为 $1,2,-1,4$，有两次符号变化，故有两个右半平面根。两个多项式的系数全为正，却得到不同稳定性结果；系数同号只是必要条件，不是三阶系统稳定的充分条件。

参数问题也可直接处理。例如 $s^3+3s^2+2s+K$ 的第一列为 $1,3,(6-K)/3,K$，严格稳定范围是 $0<K<6$。

#### 遇到零不能跳过

若第一列某元素为零而整行不为零，通常以正的小量 $\varepsilon$ 替代，按极限判断符号；若出现整行零，应使用上一行构造辅助多项式并取导数继续。整行零反映关于原点对称的根结构，不能只凭“这一行零”就宣布系统稳定。

图谱把劳斯表与特征方程、辅助多项式及具体表示相连。它们是构造与解释工具；不要把用于近似降阶的“劳斯近似法”误当成本卡的稳定性结论。

#### 自检

1. $s^3+3s^2+2s+7$ 有几个右半平面根？
2. 第一列出现零时，可否直接删除该行再数符号？

**核对要点**：两根；不可以，必须采用相应特殊情形处理。

### 关联节点

- **图谱关联**：特征方程、辅助多项式、劳斯表实例与劳斯近似法。
- **学习延伸**：奈奎斯特图提供频域判稳视角，朱利判据判断离散系统的单位圆内根。
