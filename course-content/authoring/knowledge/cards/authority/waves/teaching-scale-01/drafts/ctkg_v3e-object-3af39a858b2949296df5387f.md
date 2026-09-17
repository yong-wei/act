---
node_id: ctkg_v3e-object-3af39a858b2949296df5387f
authority_entity_id: "ctkg:v3e-object-3af39a858b2949296df5387f"
name: "幅值谱"
name_en: "Amplitude Spectrum"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-25167c5f2ebfd993ed25f345d528af58af9f2c273a2c7d552fd96bb66d3d4a4c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-25167c5f2ebfd993ed25f345d528af58af9f2c273a2c7d552fd96bb66d3d4a4c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-3af39a858b2949296df5387f.md"
asset_refs: []
---

## 首页

# 幅值谱 | Amplitude Spectrum

**一句话定义**：周期信号各谐波复系数的幅值集合。

**核心直觉**：谱线的高度告诉我们每个谐波有多强，但不保留相位正负。

**关键公式**：
$$
x(t)=Σ c_k e^(jkω₀t),  amplitude at kω₀ is |c_k|
$$

**学习目标**：从傅里叶系数读取幅值谱，并区分正负频率与相位信息。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

对周期信号，幅值谱把离散谐波的大小按频率排列。实信号的正负频率系数成共轭对，幅值相同；只看幅值谱不能恢复时间平移或相位。

请同时检查结果的正负号、数量级和归一化；若与直觉冲突，应优先回查输入类型、通道位置和初始条件。

### 教学计算/推理例

令 x(t)=2cos t+sin 2t，基频 ω₀=1。c_{±1}=1，c₂=−j/2、c_{−2}=j/2，所以 ±1 处谱线高 1，±2 处谱线高 0.5。

### 适用条件与边界

要求信号周期、基频和复系数归一化定义一致。若使用单边幅值谱，正负频率合并的系数约定要另行标注。

### 自检

1. sin 2t 的正频率系数幅值是多少？
2. 只给出幅值谱能否确定相位？

**核对要点**：为 0.5；不能，幅值谱丢失了相位。

### 关联节点

- **周期信号的频谱**（出边，关系：相关）
- **周期信号的幅值谱为一簇谱线，随频率增大包络线衰减**（入边，关系：适用于）
