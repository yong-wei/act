---
node_id: ctkg_v3e-object-5c7e75fb7bc3c6a2e80d8bb4
authority_entity_id: "ctkg:v3e-object-5c7e75fb7bc3c6a2e80d8bb4"
name: "一阶保持器"
name_en: "First-Order Hold"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-92a39e2736662edc5e16fbc1b9ebab17eec30f056472388bfd35a06820948277.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-92a39e2736662edc5e16fbc1b9ebab17eec30f056472388bfd35a06820948277.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-02a/previous/ctkg_v3e-object-5c7e75fb7bc3c6a2e80d8bb4.md"
asset_refs: []
---

## 首页
# 一阶保持器 | First-Order Hold

一句话定义：本卡按来源采用因果一阶外推保持器，用当前与过去样值估计斜率，在下一采样区间内生成线性变化信号。

- 外推保持与使用未来样值的线性插值不同。
- 初始历史样值影响第一个区间。
- 对任意数据，区间交界处可能重新调整输出。

---
## 详情
### 完整解释

取采样周期 $T$，在 $kT\le t<(k+1)T$ 内定义

$$
u_h(t)=u[k]+\frac{u[k]-u[k-1]}T(t-kT).
$$

它只用已知的两个样值，因此可以因果实现。当前区间的斜率由过去差分预测，并不保证实际下一样值等于预测终点。到下一时刻取得新值后，会从新样值重新开始外推，可能产生校正跳变。

另一种常见一阶保持约定是在 $u[k]$ 与 $u[k+1]$ 间插值，它需要未来值或延迟安排。名称相同不代表时序相同，不能把插值公式的离散等效直接用于本卡外推模型。使用时应先说明是哪一种保持。

### 教学计算/推理例

连续对象为 $\dot x=-x+u_h$。令 $a=e^{-T}$、$c=1-(1-a)/T$，对区间内线性输入积分，得到

$$
x[k+1]=ax[k]+(1-a)u[k]+c(u[k]-u[k-1]).
$$

当 $T=0.2$，$a\approx0.818731$、$c\approx0.093654$，当前输入系数约0.274923，过去输入系数约 $-0.093654$。负系数来自外推斜率表达，并不表示对象本身存在负时间。

若输入为已知斜坡 $u[k]=kT$，包括初始历史 $u[-1]=-T$，保持信号在每个区间都恰为 $u_h(t)=t$。取 $x[0]=0$，连续响应为 $x(t)=t-1+e^{-t}$，在0.2秒处约为0.018731，递推给出同样结果。若把初始历史改为0，第一个区间的外推斜率就不同，不能继续声称第一拍与该斜坡一致。

### 适用条件与边界

保持模型只规定输入区间形状，不保证任意原信号都能被正确预测。带噪样值的差分可能放大高频变化，外推也可能越过执行器范围；若再加入限幅，原线性等效需重新检查。

对线性对象，这里的采样时刻等效可按已声明的外推规律精确推导，但不等于任意一阶保持器都具有这些系数。延迟插值、预测校正等实现有各自的状态与时序。采样间响应也仍需按连续对象计算，而不是仅用端点递推替代所有约束。

频率特性和稳定性分析应包含保持器的真实实现及计算延迟。不能仅因为“一阶”高于“零阶”，就宣称在所有控制任务中性能一定更好。

### 常见误区

1. 用未来样值插值，却仍称为无延迟因果外推。
2. 忽略 $u[-1]$ 等初始历史，错误计算首拍。
3. 把对斜坡的精确保持推广到任意输入与执行器限制。

### 自检

1. 本卡外推为何不需要 $u[k+1]$？
2. 斜坡算例若未给 $u[-1]$，能否唯一确定首区间斜率？

**核对要点**：使用当前与过去样值的差分；不能，初始历史是模型的一部分，必须明确。

### 关联节点

- **保持器**（入边，关系：前置于）
- **保持器**（出边，关系：属于）
- **零阶保持器**（无向，关系：相关）
