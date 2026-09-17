---
node_id: ctkg_v3e-canonical-b9fa7b3ae0d8d7044619ac55
authority_entity_id: "ctkg:v3e-canonical-b9fa7b3ae0d8d7044619ac55"
name: "过阻尼"
name_en: "Overdamping"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-a86e3b9ad06a9163b5ae20d9d43419fb867637066b2f88066b994d56398381d9.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-a86e3b9ad06a9163b5ae20d9d43419fb867637066b2f88066b994d56398381d9.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-11a/previous/ctkg_v3e-canonical-b9fa7b3ae0d8d7044619ac55.md"
asset_refs: []
---

## 首页

# 过阻尼 | Overdamping

**一句话定义**：标准二阶模型在 $\zeta>1$ 时具有两个不同的负实特征根，称为过阻尼。

**核心直觉**：增加阻尼可以消除振荡，却可能使一个实极点更靠近原点，带来更慢的响应分量。

**关键公式**：本例 $T(s)=4/(s^2+8s+4)$，极点为 $-4\pm2\sqrt3$。

**学习目标**：解释快慢实极点与单调阶跃，并在匹配条件下比较过阻尼和临界阻尼速度。

---

## 详情

### 完整解释

标准二阶特征根为 $-\zeta\omega_n\pm\omega_n\sqrt{\zeta^2-1}$。当阻尼比大于1时，根不再含非零虚部，而是两个不同的负实数。它们产生不同衰减速度的指数分量，其中更靠近原点的极点常主导较晚的过程。

过阻尼不等于没有动态，也不等于任意情况下都最快。速度比较应固定固有频率、输入输出通道、增益和所采用的指标；否则另一个系统的带宽变化可能掩盖阻尼的作用。单调性也应从具体响应或模型条件验证。

### 教学计算/推理例

取归一化参数 $\omega_n=2$、$\zeta=2$，则
$$
T(s)=\frac4{s^2+8s+4}.
$$
记慢极点 $p_s=-4+2\sqrt3\approx-0.535898$，快极点 $p_f=-4-2\sqrt3\approx-7.46410$。零初态单位阶跃可写为
$$
y(t)=1+\frac{p_f e^{p_st}-p_s e^{p_ft}}{p_s-p_f}.
$$
代入 $t=0$ 得0，长时间后趋于1。其导数为
$$
\dot y(t)=\frac{p_sp_f(e^{p_st}-e^{p_ft})}{p_s-p_f}\ge0,
$$
因为 $p_sp_f>0$、$p_s>p_f$，在 $t\ge0$ 有 $e^{p_st}\ge e^{p_ft}$。所以这个标准模型的阶跃单调，无超调。

达到终值90%约需 $4.43571$。与相同固有频率下临界阻尼的 $1.94486$ 相比，本例更慢。慢极点接近原点，解释了为什么更大的阻尼并没有带来更快的全部过程。

### 适用条件与边界

以上结论针对无零点、单位静态增益、零初态的标准二阶通道。添加零点或改变初态时，输出可以出现不同形状，不能仅凭两个负实根保证同一单调响应。对高阶系统，也需检查是否存在更慢的其他模态。

90%到达时间只是一个比较指标，不等于2%调节时间。选择速度指标时应与教学或设计任务对应，避免把不同指标的数字混在同一比较中。

### 常见误区

1. **误区**：阻尼越大，系统一定越快。**纠正**：本例在固定固有频率下比临界阻尼更慢。
2. **误区**：两个负实根可以用一个平均极点完全代替。**纠正**：快慢两个指数分量具有不同作用，近似需要依据。

### 自检

1. 哪一个极点对较晚响应更重要？
2. 本例单调性的直接证据是什么？

**核对要点**：更靠近原点的慢极点；阶跃导数在非负时间内不小于零。

### 关联节点

- **过阻尼响应**（无向，关系：相关）
