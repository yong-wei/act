---
node_id: ctkg_v3e-object-0ca481aed329f4e6c74c8d30
authority_entity_id: "ctkg:v3e-object-0ca481aed329f4e6c74c8d30"
name: "实验频率响应测定"
name_en: "Experimental Frequency-Response Measurement"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-30f0a556a0058d1211bff4470a3c2b05896f06332ae053524bec5f086348b9e6.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-30f0a556a0058d1211bff4470a3c2b05896f06332ae053524bec5f086348b9e6.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-0ca481aed329f4e6c74c8d30.md"
asset_refs: []
---

## 首页

# 实验频率响应测定 | Experimental Frequency-Response Measurement

**一句话定义**：以不同频率的正弦激励测量输出幅值比和相位差的实验过程。

**核心直觉**：每个频率点都要等待稳态，再把输出与输入的幅值和相位配对。

**关键公式**：
$$
M(ω)=A_y(ω)/A_u(ω),  φ(ω)=φ_y(ω)−φ_u(ω)
$$

**学习目标**：设计可重复的扫频实验，并从原始正弦数据提取幅值和相位。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

实验频率响应测定是把理论的 G(jω) 变成可观察证据的过程。激励幅值应保持在线性范围，采集窗口要覆盖足够周期，且要记录输入和输出的同一时间基准。系统若不稳定，所谓“稳态幅值比”可能不存在。

### 教学计算/推理例

输入为 1 V·sin(2t)，输出稳态为 0.8 V·sin(2t−30°)。测得 M(2)=0.8，φ(2)=−30°，幅值的分贝表示为 20log10(0.8)≈−1.938 dB。

### 适用条件与边界

要求对象在测试窗口内稳定、输入输出同步且未饱和。噪声、窗函数、频率分辨率和传感器延迟要在实验记录中注明。

### 自检

1. 输出幅值 0.8、输入幅值 1 时幅值比是多少？
2. 测量到相位差 −30° 是否表示输出频率变成了另一频率？

**核对要点**：为 0.8；不是，稳定 LTI 的稳态输出仍与输入同频。

### 关联节点

- **通过改变频率的正弦信号激励系统以实验测定频率响应幅值和相位的步骤。**（入边，关系：适用于）
- **频率响应**（出边，关系：用于分析）
