---
node_id: ctkg_v3e-object-1a1dd2df4f2e6bfba96c435c
authority_entity_id: "ctkg:v3e-object-1a1dd2df4f2e6bfba96c435c"
name: "穿越频率（相位）"
name_en: "Phase-Crossover Frequency"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-bb78be89bcde5a37896c9db87df58f7c963d6ebd493a9f03301db7e3b2b173ab.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-bb78be89bcde5a37896c9db87df58f7c963d6ebd493a9f03301db7e3b2b173ab.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-1a1dd2df4f2e6bfba96c435c.md"
asset_refs: []
---

## 首页

# 穿越频率（相位） | Phase-Crossover Frequency

**一句话定义**：开环相频特性达到 −180° 的频率，通常用于读取幅值裕度。

**核心直觉**：先找相位穿越，再看同一频率的幅值；它和增益穿越的定义次序相反。

**关键公式**：
$$
ω_pc: ∠L(jω_pc)=−180°
$$

**学习目标**：在相位曲线上定位 ω_pc，并说明不存在有限穿越时的幅值裕度处理。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

相位穿越频率由相位条件决定，不是“曲线与 −180° 线附近随便取一点”。纯滞后会让相位随频率持续下降；有多个穿越时应按完整 Nyquist 关系和最不利幅值评估。

### 教学计算/推理例

考虑 L(s)=e^(−0.5s)/(s+1)，相位满足 arctan(ω)+0.5ω=π。数值解约为 ω_pc=3.67 rad/s；此处幅值约为 1/√(1+3.67²)=0.263，后续可据此计算幅值裕度。

### 适用条件与边界

需明确相位展开、单位和所用开环通道。没有有限相位穿越时不能随意报一个增益裕度；不稳定开环还需用 Nyquist 判据解释。

### 自检

1. 相位穿越频率是由幅值等于 1 定义的吗？
2. 上例的相位穿越频率约是多少？

**核对要点**：不是，它由相位 −180° 定义；约为 3.67 rad/s。

### 关联节点

- **随着频率增高，系统闭环幅频特性最终减小到零**（入边，关系：适用于）
- **幅值裕度**（出边，关系：相关）
- **阻尼自然频率**（入边，关系：相关）
