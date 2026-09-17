---
node_id: ctkg_m3-v2h_canonical-object_0c5c3925013d2cbf3cb6419b
authority_entity_id: "ctkg:m3-v2h:canonical-object:0c5c3925013d2cbf3cb6419b"
name: "频率响应匹配法"
name_en: "Frequency-Response Matching"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-cd965d6b9495ffe217d3922c7c284a4acbd7e88e1cacac90c53bbddd7d8da59d.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-cd965d6b9495ffe217d3922c7c284a4acbd7e88e1cacac90c53bbddd7d8da59d.json"
asset_refs: []
---

## 首页
# 频率响应匹配法 | Frequency-Response Matching

一句话定义：频率响应匹配法通过选择低阶模型的系数，使其在关注频段内尽量接近原高阶系统的复频率响应。

- 匹配目标应说明频段、频点及误差度量。
- 保持直流增益只保证常值输入最终增益一致。
- 降阶模型仍需核验稳定性及未匹配频段的误差。

---
## 详情
### 完整解释

高阶模型可能含有对当前任务影响较小的快速动态。为了分析或设计方便，可以选择结构更简单的低阶模型，再调整参数，使两者的幅值和相位在关心的频段内接近。可匹配若干频点的复数值，也可采用带权频段误差；具体算法不同，适用范围和误差结论也不同。

直流增益通常作为约束保留。若两个模型都稳定、最终响应存在，直流增益相同意味着对同一常值输入具有相同最终输出。但正弦稳态响应取决于对应频率的完整复数值，不能由直流一致推出所有频率的幅值和相位都一致。

### 教学计算/推理例

取原模型

$$
G(s)=\frac1{(1+s)(1+0.1s)}=\frac1{1+1.1s+0.1s^2}.
$$

选择一阶近似 $G_r=1/(1+1.1s)$。它们的直流值都为1，且在 $s=0$ 附近的一阶展开都是 $1-1.1s+O(s^2)$。这是一种偏重低频的局部匹配选择，不是整个频段上的最优近似声明。

用相对复数误差 $\varepsilon(\omega)=|G_r(j\omega)-G(j\omega)|/|G(j\omega)|$ 检验：在0.1 rad/s处约为0.000994，即0.0994%；在1 rad/s处约为0.06727，即6.727%；在10 rad/s处约为0.90536，即90.536%。同一近似在低频很好，在高频却可能偏差显著。

原系统的高频幅值按 $1/\omega^2$ 衰减，而一阶近似按 $1/\omega$ 衰减。这种阶次差异说明，不应将低频匹配模型用于没有检验的高频噪声或鲁棒性分析。两者极点均在左半平面，可保持本例稳定性；这也不能证明任意匹配算法都会保留稳定性。

### 适用条件与边界

降阶前应根据任务确定频段，例如控制交越附近、低频跟踪或某个共振区。如果忽略的模态正好影响稳定裕度或共振峰，低阶模型即使直流误差为零，也可能误导设计。非最小相位零点、延迟和不稳定模态需要特别处理，不能为降低阶次随意删除。

若使用相对误差，原响应在某频点为零时分母为零，应另选误差定义或限定范围。本例没有这种零点。模型误差与实际对象误差也不同：模型间吻合不能替代对真实系统的测量验证。

### 常见误区

1. 将“相同稳态增益”扩写成“相同的任意稳态响应”。
2. 只验证直流和一个频点，就宣称全频段等效。
3. 用低频降阶模型预测高频噪声而不检查衰减阶次。

### 自检

1. 两模型直流增益相同，能否保证10 rad/s正弦稳态一致？
2. 本例为什么适合低频近似，却不适合直接替代高频分析？

**核对要点**：不能，10 rad/s的相对复数误差约90.536%；低频展开一致，但高频衰减阶次不同。

### 关联节点

- **未建模动态**（无向，关系：相关）
- **极点删除法**（无向，关系：相关）
- **劳斯近似法**（无向，关系：相关）
