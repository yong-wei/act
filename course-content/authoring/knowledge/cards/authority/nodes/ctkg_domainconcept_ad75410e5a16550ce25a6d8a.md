---
node_id: ctkg_domainconcept_ad75410e5a16550ce25a6d8a
authority_entity_id: "ctkg:domainconcept:ad75410e5a16550ce25a6d8a"
name: "一拍系统"
name_en: "One-Step Deadbeat System"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
consevent_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-a25f8c49c4e17e767e3c2ec73696cd747f33e4970b9cb7cac647377067b4b993.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-a25f8c49c4e17e767e3c2ec73696cd747f33e4970b9cb7cac647377067b4b993.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-10a/previous/ctkg_domainconcept_ad75410e5a16550ce25a6d8a.md"
asset_refs: []
---

## 首页
# 一拍系统 | One-Step Deadbeat System

一句话定义：一拍系统在所规定的初态、参考及实现条件下，使要求的样值响应经过一个采样更新达到目标。

- 一拍需要明确所指的输入和输出任务。
- 严格因果对象通常不能在当前拍即时改变输出。
- 输入幅值限制可能使一拍目标不可实现。

---
## 详情
### 完整解释

一拍是离散最小拍设计的特殊情形。本卡指零初态单位阶跃参考下，输出样值从下一拍开始保持1。它不是“所有输入都无误差”、也不是“所有内部状态对任意初值都一步归零”。讨论前应明确采样周期、误差定义及输入何时作用于对象。

对严格因果对象，y[0]由当前初态决定，u[0]首先影响未来输出。因此从零初态跟踪在k=0跳变的单位参考，至少需要一次状态更新。一拍设计要在这个下界上给出可因果执行且满足约束的控制。

### 教学计算/推理例

取 $x[k+1]=0.8x[k]+0.2u[k]$、y[k]=x[k]，初态为零。采用单位负反馈e=r-y及控制器

$$
C(z)=5\frac{z-0.8}{z-1}.
$$

对象为 $G(z)=0.2/(z-0.8)$，所以零初态参考传递函数为 $\Phi(z)=CG/(1+CG)=z^{-1}$。差分控制律为

$$
u[k]=u[k-1]+5e[k]-4e[k-1],
$$

并规定u[-1]=e[-1]=0。单位阶跃开始时e[0]=1，因此u[0]=5，下一状态x[1]=1。随后e[1]=0，控制律给出u[1]=5-4=1，x[2]=0.8+0.2=1；以后误差继续为零，输入维持1，输出样值保持1。

这同时核对了闭环传递式、真实控制器记忆和对象递推。原互连未约消的特征多项式含z和z-0.8，内部极点为0与0.8，都在单位圆内；不能仅凭简化式z的逆就把内部模态全部说成零。

### 约束会改变可达性

如果执行器限制 $|u[k]|\leq2$，零初态第一步最多只能得到x[1]=0.2×2=0.4，无法达到1。因此相同对象和目标在这个幅值约束下不可能一拍实现，原控制器的首拍要求5明显超限。

把u[0]截到2后，已经改变实际闭环，不能继续用原来的Phi说明输出下一拍必为1。应重新设计允许的拍数、输入序列或性能目标，并核验后续状态，而不是只调整图上的显示范围。

### 与连续无纹波的联系

若该离散对象确实来自 $\dot x=-x+u$、零阶保持及 $T=\ln(5/4)$，则第一拍达到x=1后，输入改为1，使连续导数也为零。这时可以进一步证明t至少为T时连续输出保持1。

这种额外结论依赖一状态连续对象及保持假设。对于有多个内部状态的对象，输出样值一拍到位时，其他状态仍可能让采样间输出变化。不能把本例的无纹波性质从“一拍”这个名称推广到所有高阶采样系统。

### 适用条件与边界

改变参考为斜坡，或对象和控制器初态不再为零时，需要重新计算响应。即使系统稳定，也不代表它对每种输入、每个初值都有相同的一拍整定性质。更多延迟和非最小相位零点也会限制可实现的响应速度。

理想控制器使用精确系数和规定时序。实际数字实现中的量化、计算延迟及饱和，都会影响有限拍误差是否真的为零，应按实际模型报告残余误差。

### 常见误区

1. 把一拍阶跃跟踪解释为任意输入的即时无误差跟踪。
2. 忽略首拍输入要求而仍宣称可实现。
3. 从低阶例子的无纹波性质推断所有高阶对象相同。

### 自检

1. 本例前两拍输入为什么分别为5和1？
2. 输入上限2时，第一拍能够达到的最大输出是多少？

**核对要点**：首拍要克服对象0.2的输入系数，随后只需维持平衡；最大为0.4，因此不能一拍达到1。

### 关联节点

- **最小拍系统**（无向，关系：相关）
