---
node_id: ctkg_v3e-canonical-adb3110b78ea9d623101aaa7
authority_entity_id: "ctkg:v3e-canonical-adb3110b78ea9d623101aaa7"
name: "部分分式展开"
name_en: "Partial-Fraction Expansion"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-d397d7d7225cf3fa1a9433d138e9e67a8713225d1bc7a0b010c1271727e0c04c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-d397d7d7225cf3fa1a9433d138e9e67a8713225d1bc7a0b010c1271727e0c04c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-adb3110b78ea9d623101aaa7.md"
asset_refs: []
---

## 首页

# 部分分式展开 | Partial-Fraction Expansion

**一句话定义**：把有理拉氏函数拆成多个可查表的简单项，以便求反变换。

**核心直觉**：复杂分母的每个极点贡献一个可识别模态，拆开后时间响应可逐项相加。

**关键公式**：
$$
F(s)=\sum_i\frac{C_i}{s-p_i}\quad\text{(simple poles)}
$$

**学习目标**：选择合适的部分分式形式并由系数还原时间响应。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

部分分式展开连接了极点和时域模态。互异简单极点对应指数项，重复极点对应 t 的幂乘指数，共轭极点对应衰减正弦。展开前要检查真分式；若分子次数不小于分母，必须先长除。

### 教学计算/推理例

F(s)=(s+4)/[s(s+2)]。设 F=A/s+B/(s+2)，比较系数得 A=2、B=−1，所以 f(t)=2−e^(−2t)，t=1 s 时约 1.8647。

### 适用条件与边界

要求有理函数、分母可因式分解且选择与极点重数匹配的项。非零初始条件会影响分子或附加自由响应。

### 自检

1. 为什么重复极点要出现 t 的幂？
2. F(s)=(s+4)/[s(s+2)] 中 1/s 的系数是多少？

**核对要点**：因为重复极点的反变换包含 t 的幂乘指数；系数为 2。

### 关联节点

- **不同极点部分分式展开法**（出边，关系：前置于）
- **有理分式拉普拉斯变换**（入边，关系：相关）
- **部分分式拉普拉斯反变换法**（入边，关系：相关）
- **s平面零极点图解留数法**（入边，关系：相关）
- **部分分式展开法**（入边，关系：相关）
