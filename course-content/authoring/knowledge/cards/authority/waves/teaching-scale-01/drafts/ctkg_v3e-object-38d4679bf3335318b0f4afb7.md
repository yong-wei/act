---
node_id: ctkg_v3e-object-38d4679bf3335318b0f4afb7
authority_entity_id: "ctkg:v3e-object-38d4679bf3335318b0f4afb7"
name: "频率特性"
name_en: "Frequency Characteristic"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-ebd0d8336c3cd53d34b2abd2840d7cb2b6b7fe2f0a394d0887b77d3c77588db3.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-ebd0d8336c3cd53d34b2abd2840d7cb2b6b7fe2f0a394d0887b77d3c77588db3.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-38d4679bf3335318b0f4afb7.md"
asset_refs: []
---

## 首页

# 频率特性 | Frequency Characteristic

**一句话定义**：正弦输入下输出同频分量的幅值比与相位差组成的复数频率特性。

**核心直觉**：把幅值和相位合成一个复数，便于在 Bode 或 Nyquist 表征中转换。

**关键公式**：
$$
G(jω)=A(ω)e^(jφ(ω))
$$

**学习目标**：由指定频率的幅值和相位构造复数频率特性，并说明测量前提。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

频率特性同时包含幅频和相频两部分。对稳定 LTI，输入频率不变时稳态输出保留同一频率，只改变幅值和相位；频率特性不是任意瞬态曲线的点值。

### 教学计算/推理例

在 ω=1 rad/s，若 A=0.5、φ=−60°，则 G(jω)=0.5∠−60°=0.25−j0.4330。该复数点可以转换为幅相图上的一个频率标记。

### 适用条件与边界

要求系统稳定、线性定常且等待稳态。对不稳定系统，实验输出包含发散模态，不能直接称为稳定频率特性。

### 自检

1. A=0.5、φ=−60°时复数实部约是多少？
2. 幅频特性和频率特性是同一个量吗？

**核对要点**：约为 0.25；不是，频率特性还包含相位信息。

### 关联节点

- **期望的开环频率特性形状**（入边，关系：相关）
- **幅频特性**（出边，关系：相关）
- **频率特性实验确定方法**（入边，关系：适用于）
- **对于不稳定系统，输出响应稳态分量中含有由系统传递函数的不稳定极点产生的呈发散或振荡发散的分量，所以不稳定系统的频率特性不能通过实验方法确定。**（入边，关系：适用于）
- **相频特性**（出边，关系：相关）
