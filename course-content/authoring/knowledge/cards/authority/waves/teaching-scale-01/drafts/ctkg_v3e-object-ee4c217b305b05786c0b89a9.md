---
node_id: ctkg_v3e-object-ee4c217b305b05786c0b89a9
authority_entity_id: "ctkg:v3e-object-ee4c217b305b05786c0b89a9"
name: "正弦稳态响应"
name_en: "Sinusoidal Steady-State Response"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-2becb76f6fe7e1a1ee39ae94a473272c4a06b5ddeb71ac58e4b855e6cad615a2.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-2becb76f6fe7e1a1ee39ae94a473272c4a06b5ddeb71ac58e4b855e6cad615a2.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-ee4c217b305b05786c0b89a9.md"
asset_refs: []
---

## 首页

# 正弦稳态响应 | Sinusoidal Steady-State Response

**一句话定义**：稳定线性系统在正弦激励下，瞬态衰减后保留输入频率的稳态输出。

**核心直觉**：系统改变幅值和相位，不改变稳定 LTI 正弦稳态的频率。

**关键公式**：
$$
u=A sin(ωt) ⇒ y_ss=A|G(jω)|sin(ωt+φ)
$$

**学习目标**：由 G(jω) 写出输出振幅和相位，并说明“稳态”所需等待条件。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

正弦稳态响应是频率响应的时间域表达。自然响应衰减后，输出和输入同频；幅值比由 |G(jω)| 给出，相位由 arg G(jω) 给出。若系统不稳定或处于饱和，不能把观察到的有限窗口当成稳态结论。

### 教学计算/推理例

取 G(s)=1/(s+1)、输入 u=2sin t。|G(j)|=1/√2，φ=−45°，所以 y_ss=√2 sin(t−45°)，输出振幅约 1.414。

### 适用条件与边界

要求稳定 LTI、正弦持续时间足够长且输入不触发非线性。初始瞬态、噪声和采样相位应与稳态估计分开。

### 自检

1. 上例输出频率是 1 rad/s 还是 1/√2 rad/s？
2. 输出振幅为什么不是输入振幅 2？

**核对要点**：仍是 1 rad/s；因为系统在该频率的幅值比是 1/√2。

### 关联节点

- **稳态响应**（入边，关系：相关）
- **在jω轴上计算G(s)有助于判定闭环稳定性，因为jω轴是稳定与不稳定的分界线。**（入边，关系：用于分析）
- **对于线性定常系统，稳态输出是与输入同频率的正弦信号，且幅值比和相位与输入幅值无关。**（入边，关系：适用于）
- **自然无激励响应**（入边，关系：相关）
- **由正弦信号激励的传递函数为G(s)的稳定系统，进入稳态后将输出同频率的正弦信号，其幅值为M(ω_o)，相位为φ(ω_o)。**（入边，关系：适用于）
