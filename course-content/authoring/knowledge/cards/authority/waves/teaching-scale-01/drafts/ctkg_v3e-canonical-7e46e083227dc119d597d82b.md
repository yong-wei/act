---
node_id: ctkg_v3e-canonical-7e46e083227dc119d597d82b
authority_entity_id: "ctkg:v3e-canonical-7e46e083227dc119d597d82b"
name: "频率响应"
name_en: "Frequency Response"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-af679057b50299f79747230130880d6471b5f4788916ba07302f8d5fec511fdc.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-af679057b50299f79747230130880d6471b5f4788916ba07302f8d5fec511fdc.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-7e46e083227dc119d597d82b.md"
asset_refs: []
---

## 首页

# 频率响应 | Frequency Response

**一句话定义**：稳定线性系统受正弦输入后，瞬态衰减后在各频率上的幅值和相位关系。

**核心直觉**：把 s 放到 jω 轴上，就能把动态系统看成随频率变化的复数增益。

**关键公式**：
$$
G(jω)=|G(jω)|e^(jφ(ω))
$$

**学习目标**：从传递函数计算指定频率的幅值和相位，并连接到实验测量。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

频率响应描述同一频率的正弦输入与稳态输出。对稳定 LTI，输入 A sin(ωt) 后输出幅值为 A|G(jω)|、相位偏移为 φ(ω)。频域方法的结论依赖稳定和线性；它不能直接替代含大幅度非线性的时域实验。

### 教学计算/推理例

取 G(s)=1/(s+1)、ω=1 rad/s，则 |G(jω)|=1/√2≈0.7071、φ=−45°。输入幅值 2 的正弦，稳态输出幅值为 √2≈1.4142。

### 适用条件与边界

需要等待瞬态衰减、保持输入在近似线性范围，并明确角频率单位 rad/s。多个模态或不稳定系统不能用单一正弦稳态假设掩盖发散部分。

### 自检

1. G(s)=1/(s+1) 在 ω=1 的相位是多少？
2. 频率响应的幅值是否依赖正弦输入幅值？

**核对要点**：为 −45°；在线性范围内，幅值比不依赖输入幅值。

### 关联节点

- **幅相频率特性**（入边，关系：相关）
- **相位（频率响应）**（入边，关系：相关）
- **频率响应法**（入边，关系：相关）
- **频率响应法的第二个优势在于，描述系统正弦稳态特性的传递函数可以通过将系统传递函数 T(s) 中的 s 替换为 jω 来获得。**（入边，关系：适用于）
- **线性系统对正弦输入的频率响应可根据其零极点位置求得。**（入边，关系：适用于）
