---
node_id: ctkg_v3e-object-c2881833cb4d8b1e415dc742
authority_entity_id: "ctkg:v3e-object-c2881833cb4d8b1e415dc742"
name: "幅值裕度"
name_en: "Gain Margin (Amplitude Margin)"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-ea8b55856ec1377fdbb1bdb20df31061bf9003b45224b3d562348048e07fe7d5.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-ea8b55856ec1377fdbb1bdb20df31061bf9003b45224b3d562348048e07fe7d5.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-c2881833cb4d8b1e415dc742.md"
asset_refs: []
---

## 首页

# 幅值裕度 | Gain Margin (Amplitude Margin)

**一句话定义**：在相位穿越频率处，开环幅值距离临界值的可放大倍数。

**核心直觉**：先找 −180° 相位点，再问开环增益还可放大多少才触及临界边界。

**关键公式**：
$$
GM=1/|L(jω_pc)|,  GM_dB=20log₁₀(GM)
$$

**学习目标**：计算线性幅值裕度及其 dB 表示，并说明交越和开环稳定边界。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

幅值裕度是相对稳定性指标，和相位裕度互补。线性倍数 GM 与 dB 数值不是同一个量；当存在多个相位穿越时，必须按最不利临界点和 Nyquist 轨迹解释。

### 教学计算/推理例

若相位穿越点满足 |L(jω_pc)|=0.25，则 GM=4，GM_dB=20log₁₀4≈12.041 dB。在线性增益整体放大 4 倍的临界假设下，轨迹可能触及 −1 点，但完整闭环仍要按适用判据检查。

### 适用条件与边界

要求相位穿越点明确、频率响应和增益单位一致。开环不稳定、非最小相位或无有限穿越时，不能用简单正数叙述全部稳定性。

### 自检

1. |L|=0.25 时 GM 是多少？
2. GM=4 的 dB 值约是多少？

**核对要点**：为 4；约 12.041 dB。

### 关联节点

- **对于具有不稳定开环系统的非最小相位系统，除非 G（+jω） 图包围 （-1+j0） 点，否则不能满足稳定条件。因此，这种稳定的非最小相位系统将具有负的相角裕度和幅值裕度。**（入边，关系：适用于）
- **穿越频率（相位）**（入边，关系：相关）
- **随着频率增高，系统闭环幅频特性最终减小到零**（入边，关系：适用于）
- **为了得到满意的性能，相角裕度应当为30°～60°，幅值裕度应当大于6dB。**（入边，关系：相关）
- **幅值裕度 h 的含义是，对于闭环稳定系统，如果系统开环幅频特性再增大 h 倍，则系统将处于临界稳定状态；对于闭环不稳定的系统，幅值裕度指出了为使系统临界稳定，开环幅频特性应当减小到原来的 1/h。**（入边，关系：适用于）
