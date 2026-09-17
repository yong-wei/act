---
node_id: ctkg_v3e-canonical-060bc33f21e93205ee271eda
authority_entity_id: "ctkg:v3e-canonical-060bc33f21e93205ee271eda"
name: "部分分式展开的覆盖法"
name_en: "Cover-Up Method for Partial Fractions"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b85fe73949ab09930c2fbac0c408c5c06c2d28d8ef603782e2264dae1a24deee.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b85fe73949ab09930c2fbac0c408c5c06c2d28d8ef603782e2264dae1a24deee.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-060bc33f21e93205ee271eda.md"
asset_refs: []
---

## 首页

# 部分分式展开的覆盖法 | Cover-Up Method for Partial Fractions

**一句话定义**：对互异简单极点，用覆盖法直接求部分分式系数。

**核心直觉**：在某个极点处把对应因子消掉，剩余表达式的数值就是该项系数。

**关键公式**：
$$
C_i = lim(s→p_i) (s−p_i)F(s)
$$

**学习目标**：识别互异简单极点并用代入求系数，遇到重极点时停止机械套用。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

设 F(s)=N(s)/[(s−p₁)(s−p₂)…] 且极点互异。乘以 (s−p_i) 后令 s=p_i，其他因子不会为零，于是直接得到 C_i。这个方法是部分分式展开的一种计算入口，不是新的变换定理。

### 教学计算/推理例

F(s)=(2s+3)/[(s+1)(s+2)]。在 s=−1 处 C₁=(−2+3)/(−1+2)=1；在 s=−2 处 C₂=(−4+3)/(−2+1)=1。因此 F=1/(s+1)+1/(s+2)，f(1)=e^(−1)+e^(−2)≈0.5032。

### 适用条件与边界

要求分母已因式分解、极点互异且为简单极点。重根要按重复幂次设项；分子次数过高时先做长除法。

### 自检

1. 对 s=−1 的系数为什么不需要先求另一个系数？
2. 出现 (s+1)² 时还能直接只覆盖一次吗？

**核对要点**：因为代入 −1 会消去其他项并留下该系数；不能，需要加入重复极点项。

### 关联节点

- **用于拉普拉斯逆变换的 Heaviside 部分分式展开**（入边，关系：相关）
- **部分分式展开法**（入边，关系：相关）
- **部分分式展开留数**（入边，关系：相关）
- **用于拉普拉斯逆变换的图解留数求值**（入边，关系：相关）
- **部分分式拉普拉斯反变换法**（入边，关系：相关）
