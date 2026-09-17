---
node_id: ctc_modeling-c26fddc50074ec84707d5950
authority_entity_id: "ctc:modeling-c26fddc50074ec84707d5950"
name: "常系数线性定常系统"
name_en: "Linear Time-Invariant System with Constant Coefficients"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f7a5d649bcd0bb155d799b3e6be3327134c34a322574e202a328068e7de9cd2a.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f7a5d649bcd0bb155d799b3e6be3327134c34a322574e202a328068e7de9cd2a.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctc_modeling-c26fddc50074ec84707d5950.md"
asset_refs: []
---

## 首页

# 常系数线性定常系统 | Linear Time-Invariant System with Constant Coefficients

**一句话定义**：系数矩阵为常数、满足线性叠加和时间平移不变性的系统。

**核心直觉**：矩阵 $A$ 不随时间变化，使同一组动态模态可以在不同时间复用。

**关键公式**：
$$
\dot x=Ax+Bu,\qquad y=Cx+Du\quad(A,B,C,D\ \text{constant})
$$

**学习目标**：从状态方程识别线性定常假设，并利用矩阵指数理解响应。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

常系数线性定常系统同时具备线性和时不变性：输入叠加可对应输出叠加，系统对输入延迟的响应也相应延迟。常数矩阵并不保证稳定，稳定性仍要看 $A$ 的特征值或闭环特征方程。

### 教学计算/推理例

取标量模型 $\dot x=-x+2u$、$y=x$，单位阶跃、零初始条件下 $y(t)=2(1-e^{-t})$；在 $t=1$ 时 $y\approx1.2642$。矩阵 $A=-1$ 的唯一特征值为 $-1$，所以自由响应衰减。

### 适用条件与边界

计算要求参数不随时间变化且工作在线性范围。离散系统或时变参数应使用对应的离散/时变模型，不能直接套用常系数结论。

### 自检

1. $A=+1$ 时自由响应是衰减还是增长？
2. 线性定常是否自动意味着稳定？

**核对要点**：增长；不意味着，线性定常系统也可能不稳定。

### 关联节点

- **矩阵指数函数**（出边，关系：相关）
- **齐次状态方程拉氏变换解法**（出边，关系：相关）
