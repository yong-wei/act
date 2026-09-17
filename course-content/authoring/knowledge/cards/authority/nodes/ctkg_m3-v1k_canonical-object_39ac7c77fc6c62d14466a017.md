---
node_id: ctkg_m3-v1k_canonical-object_39ac7c77fc6c62d14466a017
authority_entity_id: "ctkg:m3-v1k:canonical-object:39ac7c77fc6c62d14466a017"
name: "帕德近似"
name_en: "Padé Approximation"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-5076ada4109d10322b0af30b4b13d160199c6bd0067979e8287ea0c13af594a5.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-5076ada4109d10322b0af30b4b13d160199c6bd0067979e8287ea0c13af594a5.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/纯延迟_2_8f4165fd.md"
asset_refs: []
---

## 首页

# 帕德近似 | Padé Approximation

**一句话定义**：用有理函数近似纯时延传递函数 $e^{-sT_d}$ 的方法。

**核心直觉**：低阶有理式保留低频延迟的相位趋势，却会引入近似模型自身的零点和极点。

**关键公式**：
$$
e^{-sT}\approx\frac{1-sT/2}{1+sT/2}\quad\text{(first order)}
$$

**学习目标**：在需要代数或根轨迹分析时使用低阶 Padé，并标出近似频段及新增非最小相位零点。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

一阶 Padé 近似在 $s=0$ 附近匹配纯延迟的低阶展开：$e^{-sT}=1-sT+O(s^2)$。近似式的零点位于右半平面、极点位于左半平面，因此它能用于某些连续系统分析，却不等价于真实延迟的全部频率行为。

### 教学计算/推理例

当 $T=0.4\,\mathrm s$ 时，$e^{-0.4s}\approx(1-0.2s)/(1+0.2s)$；近似零点为 $+5$，极点为 $-5$。在低频，幅值约为 $1$，相位斜率约为 $-0.4\,\mathrm{rad/(rad/s)}$。

### 适用条件与边界

适用低频、延迟相对带宽不太大且需要有理模型的分析。高频、强延迟或对非最小相位敏感的设计应保留纯延迟或提高阶次并复核。

### 自检

1. 一阶 Padé 的零点在左半平面还是右半平面？
2. 把一阶近似当作精确延迟，能否保证高频相位完全一致？

**核对要点**：在右半平面；不能，近似只在标明的频段内可信。

### 关联节点

- **纯时延传递函数**（入边，关系：相关）
- **纯时延传递函数**（出边，关系：适用于）
- **时间延迟**（入边，关系：相关）
- **劳斯近似法**（入边，关系：相关）
