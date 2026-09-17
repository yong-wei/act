---
node_id: ctkg_v3e-canonical-b1b7acfdda35086ace2d7091
authority_entity_id: "ctkg:v3e-canonical-b1b7acfdda35086ace2d7091"
name: "不同极点部分分式展开法"
name_en: "Distinct-Pole Partial-Fraction Method"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-9984fc132ccbb70533bce65ffa2d0fe18757a76f2a625a2ee342e92df85b0c37.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-9984fc132ccbb70533bce65ffa2d0fe18757a76f2a625a2ee342e92df85b0c37.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-b1b7acfdda35086ace2d7091.md"
asset_refs: []
---

## 首页

# 不同极点部分分式展开法 | Distinct-Pole Partial-Fraction Method

**一句话定义**：针对互异极点，按每个极点分别求留数并组成展开式的方法。

**核心直觉**：极点不重合时，每个模态的系数彼此独立，代入极点即可得到。

**关键公式**：
$$
C_i=\frac{N(p_i)}{D'(p_i)},\qquad D(p_i)=0,\quad D'(p_i)\ne0
$$

**学习目标**：对互异极点使用导数形式或覆盖法求系数，并核对重构。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

若 F=N/D 且 p_i 是简单根，则 D(s)≈D′(p_i)(s−p_i)，所以 C_i=N(p_i)/D′(p_i)。这是覆盖法的代数版本，强调极点必须互异；对重复根要改用导数或待定系数法。

### 教学计算/推理例

F(s)=(3s+5)/[(s+1)(s+3)]。在 −1 处 C=2/2=1，在 −3 处 C=(−4)/(−2)=2；因此 f(t)=e^(−t)+2e^(−3t)，t=1 s 时约 0.4675。

### 适用条件与边界

要求真分式或先完成长除，且所有目标极点为简单根。数值接近重根时应警惕病态和舍入误差。

### 自检

1. D′(p_i)为什么不能为零？
2. 上例中 s=−3 的系数是多少？

**核对要点**：否则该根不是简单极点；系数为 2。

### 关联节点

- **部分分式展开**（入边，关系：前置于）
- **用于拉普拉斯逆变换的 Heaviside 部分分式展开**（入边，关系：相关）
- **部分分式展开覆盖法**（入边，关系：相关）
- **部分分式拉普拉斯反变换法**（入边，关系：相关）
- **部分分式展开法**（入边，关系：相关）
