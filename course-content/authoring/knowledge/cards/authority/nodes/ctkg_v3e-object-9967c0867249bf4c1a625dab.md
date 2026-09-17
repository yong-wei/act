---
node_id: ctkg_v3e-object-9967c0867249bf4c1a625dab
authority_entity_id: "ctkg:v3e-object-9967c0867249bf4c1a625dab"
name: "相频特性"
name_en: "Phase Characteristic"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b8aaadb219a869aacadbf362dff3534b20bf00e38ff66634e43733c5cae0fd3c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b8aaadb219a869aacadbf362dff3534b20bf00e38ff66634e43733c5cae0fd3c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-9967c0867249bf4c1a625dab.md"
asset_refs: []
---

## 首页

# 相频特性 | Phase Characteristic

**一句话定义**：正弦输入下输出相对输入的相位偏移 φ(ω)。

**核心直觉**：相位说明输出提前或滞后多少角度，不能由幅值曲线代替。

**关键公式**：
$$
φ(ω)=arg G(jω)
$$

**学习目标**：从频率响应计算相位，并把角度符号与时间领先/滞后对应起来。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

相频特性记录输出同频分量相对输入的相位差。对稳定线性定常系统，输入 A sin(ωt) 后，输出相位为输入相位加 φ(ω)；负值表示滞后，正值表示领先。相位要与同一输入输出通道的幅值配对，且角度应连续展开，避免跨 −180° 时误读。

相位不是时间单位。固定频率下可换算等效时间偏移 Δt=−φ/ω，但这个换算随频率变化，不能把一条相频曲线当成固定延迟。

### 教学计算/推理例

取 G(s)=1/(s+1)，在 ω=1 rad/s 有 G(jω)=(1−j)/2，因此幅值为 1/√2、相位为 −45°。若输入为 sin(t)，稳态输出为 (1/√2)sin(t−45°)。

### 适用条件与边界

假设稳定 LTI、正弦稳态和统一的角度单位。纯延迟、测量延迟和非最小相位零点都可能显著改变相位，不能只看幅值。

### 自检

1. G(s)=1/(s+1) 在 ω=1 的相位是多少？
2. 相位 −90° 是否表示输出幅值一定为 0？

**核对要点**：为 −45°；不表示，幅值由 |G(jω)| 独立决定。

### 关联节点

- **相角裕度**（出边，关系：用于分析）
- **频率特性**（入边，关系：相关）
- **幅频特性**（出边，关系：相关）
