---
node_id: ctkg_m1s-object-2ce2e2dd44688b16823d91c2
authority_entity_id: "ctkg:m1s-object-2ce2e2dd44688b16823d91c2"
name: "严格无源阻抗"
name_en: "Strictly Passive Impedance"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
confourt_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-d2e3d466aca4d5cf1fbf96233846d36b3203f4d9c6384620187e98c8a21eb8d1.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-d2e3d466aca4d5cf1fbf96233846d36b3203f4d9c6384620187e98c8a21eb8d1.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-14a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 严格无源阻抗 | Strictly Passive Impedance

一句话定义：本卡沿用阻抗语境中的严格无源要求：实部在全部实频率上具有统一的正下界，并结合相应因果与正实性条件分析耗散。

- 全频率统一正下界强于仅在有限频率处为正。
- 不能与所有严格正实定义直接混同。
- 虚轴实部检查不能取代极点与实现条件。

---
## 详情
### 完整解释

线性阻抗可写为 $Z(j\omega)=R(\omega)+jX(\omega)$。在本文采用的原教材语境中，存在正常数δ，使全部实频率满足 $R(\omega)>\delta>0$，表明阻性部分具有统一的耗散下界。这里要求同一个δ对所有频率成立，不是每个频率分别找一个越来越小的正数。

频率条件应放在正确的系统语境中使用。对抽象传递函数，还要检查相应的正实性极点条件和因果实现，不能看到虚轴实部为正就忽略右半平面极点。下面采用一个明确的稳定RC阻抗，并从端口功率独立验证耗散。

### 教学计算/推理例

取归一化串联电阻与并联RC支路，所有电阻与电容参数取1。令输入电流为i，RC支路电压为x，端口电压为v，则

$$
\dot x=-x+i,\qquad v=x+i,
\qquad Z(s)=1+\frac{1}{s+1}.
$$

唯一动态极点为-1，模型稳定且因果。频率实部为 $R(\omega)=1+1/(1+\omega^2)$，所以可选择δ=1/2，对全部实ω都满足R大于δ。即使频率很高，串联电阻仍保留这个统一下界。

令储能函数 $V_s=x^2/2$，沿原状态方程求导得到 $\dot V_s=-x^2+ix$。端口输入功率为iv，因此

$$
iv-\dot V_s=i(x+i)-(-x^2+ix)=i^2+x^2.
$$

右侧是两个归一化电阻对应的非负耗散项，频率实部结论与时域功率平衡一致。这个例子既给出传递函数，也给出内部储能与耗散，避免把一个频率标签当作全部物理证明。

### 与严格正实的区别

对照 $Z_0(s)=1/(s+1)$，它在KYP引理常用的移位定义下是严格正实函数，但实部为1/(1+ω²)，高频趋于零。因此不存在本文要求的统一δ大于零，使所有频率实部都大于δ。

这不是两个结论矛盾，而是“严格”的定义条件不同。使用严格无源、输入严格无源或严格正实等术语时，应写清实际不等式和变量，不能只根据中文或英文名称相近就把结论互相替换。

### 为什么还要检查极点

例如形式传递函数 $Z_b(s)=2-1/(s-1)$ 在虚轴上的实部为 $2+1/(1+\omega^2)$，同样有正下界，但它含右半平面极点+1。它不满足这里无源分析所需的正实性极点条件，不能据这条代数频响就将不稳定实现视为已证明无源。

实际频率响应测试也只在有限频带和有限精度下提供数据。要从测量推到全频率和内部性质，需要相应模型及证据，不能把有限采样点的实部全部为正当作统一严格下界证明。

### 适用条件与边界

本例为单端口、线性归一化电路，电流按进入正电压端的供能方向定义。改变端口方向或变量定义时，功率符号应同步调整；多端口系统则需要相应矩阵条件，不能逐元素套用同一标量不等式。

内部状态若没有被端口观察到，也不能只凭可见阻抗忽略隐藏动态。本文RC实现直接给出了储能和稳定状态方程，其结论以这个明确实现为依据。

### 常见误区

1. 把逐频率正值当成全频率统一的正下界。
2. 将所有严格正实函数都归入本卡的严格阻抗条件。
3. 只看虚轴实部而忽略不稳定极点。

### 自检

1. 本例为什么可以统一选择δ=1/2？
2. Z0与Zb两个对照分别提醒检查什么？

**核对要点**：串联电阻使实部始终至少为1；前者说明严格性定义不同，后者说明频率代数实部不能替代极点条件。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
