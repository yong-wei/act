---
node_id: ctkg_v3e-object-232e387ed53e92abee078346
authority_entity_id: "ctkg:v3e-object-232e387ed53e92abee078346"
name: "截止频率"
name_en: "Cutoff Frequency"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-868f4f01c9e9c2ec249c16f9c585ea93a4f7461f9be33f73f411e64ec70b1a0d.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-868f4f01c9e9c2ec249c16f9c585ea93a4f7461f9be33f73f411e64ec70b1a0d.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-232e387ed53e92abee078346.md"
asset_refs: []
---

## 首页

# 截止频率 | Cutoff Frequency

**一句话定义**：开环幅频特性达到 1（0 dB）时的频率，记为 ω_c。

**核心直觉**：在幅值图上找 0 dB 交点，它常与闭环速度相关，但不是闭环带宽的同义词。

**关键公式**：
$$
|G(jω_c)|=1
$$

**学习目标**：从幅频表达式求 ω_c，并区分固定开环和含控制增益的交越定义。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

本卡使用图谱中的开环指标定义。若环路写成 K G(s)，则 K 也要进入幅值条件；改变 K 会移动交越点。ω_c 不是闭环幅值下降 3 dB 的带宽频率，二者只有在附加条件下才可近似联系。

### 教学计算/推理例

取 G(s)=10/(s+1)，有 |G(jω)|=10/√(1+ω²)。令其等于 1，得 ω_c=√99≈9.9499 rad/s。若再乘一个 K，必须用 |KG|=1 重算。

### 适用条件与边界

要求开环频率响应定义清晰、幅值采用线性比值或等价 dB。多次 0 dB 穿越时要报告各交点及其相位。

### 自检

1. G(s)=10/(s+1) 的 ω_c 是多少？
2. ω_c 是否等于闭环带宽频率？

**核对要点**：约为 9.9499 rad/s；不一定，需根据闭环响应和相对稳定程度验证。

### 关联节点

- **谐振峰值 M_r 和开环指标相角裕度 γ 都能表征系统的稳定程度，近似关系为 M_r ≈ 1/|sin γ|。**（入边，关系：适用于）
- **控制系统的设计中，一般先根据控制要求提出闭环频域指标 ω_b 和 M_r，再由式（5-104）确定相角裕度 γ 和选择合适的截止频率 ω_c，然后根据 γ 和 ω_c 选择校正网络的结构并确定参数。**（入边，关系：适用于）
- **系统开环指标截止频率 ω_c 与闭环指标带宽频率 ω_b 有着密切的关系。如果两个系统的稳定程度相仿，则 ω_c 大的系统，ω_b 也大；ω_c 小的系统，ω_b 也小。**（入边，关系：相关）
- **带宽频率**（出边，关系：相关）
- **阻尼自然频率**（入边，关系：相关）
