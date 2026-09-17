---
node_id: ctkg_v3e-object-1946643d6912e8d8aeb2decb
authority_entity_id: "ctkg:v3e-object-1946643d6912e8d8aeb2decb"
name: "内模原理"
name_en: "Internal Model Principle"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b5cd5819aca4fad65b47fbe91b637bb55a8d20c0cfbfb1356839af150160cc8f.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b5cd5819aca4fad65b47fbe91b637bb55a8d20c0cfbfb1356839af150160cc8f.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-04a/previous/ctkg_v3e-object-1946643d6912e8d8aeb2decb.md"
asset_refs: []
---

## 首页
# 内模原理 | Internal Model Principle

一句话定义：要对某类参考或扰动实现鲁棒的渐近调节，控制器需要包含相应信号生成动态的内模，并使调节问题可解且闭环稳定。

- 常值信号的内模对应积分动态。
- 正弦等其他信号类别需要相应动态，不能一律只加积分器。
- 有内模是结构要求，不能代替闭环稳定与可实现性检查。

---
## 详情
### 完整解释

常值参考可以由 $\dot w=0$ 生成，误差积分器提供与之对应的零频动态，使系统能够持续调整输入来消除常值稳态偏差。更一般的参考或扰动由外部动态系统生成，鲁棒调节设计需要让控制器包含适当的生成器结构。这里的“包含”指动态模型和相应结构，不是把参考信号的拉普拉斯表达式直接乘进控制器。

本卡重点解释常值信号的一维例子。一般多输出鲁棒调节还涉及内模的重复结构、对象在相关频率的可调节条件等，不能仅凭控制器有某个极点就宣告问题已解决。尤其当对象在信号频率存在妨碍调节的不变零点时，需先检查调节方程是否可解。

### 教学计算/推理例

考虑双积分器 $\dot x_1=x_2$、$\dot x_2=u$、$y=x_1$。加入误差积分状态 $\dot z=r-y$，采用 $u=-11x_1-6x_2+6z$。在增广坐标 $(x_1,x_2,z)$ 下，闭环为

$$
\begin{pmatrix}\dot x_1\\\dot x_2\\\dot z\end{pmatrix}
=\begin{pmatrix}0&1&0\\-11&-6&6\\-1&0&0\end{pmatrix}
\begin{pmatrix}x_1\\x_2\\z\end{pmatrix}
+\begin{pmatrix}0\\0\\1\end{pmatrix}r.
$$

其特征多项式为 $s^3+6s^2+11s+6=(s+1)(s+2)(s+3)$，闭环严格稳定。对单位常值参考，平衡条件依次给出 $x_2=0$、$x_1=1$、$z=11/6$。稳定性保证轨迹趋于此平衡，所以输出渐近跟踪1。

若输入端还叠加未知常值扰动d，即 $\dot x_2=u+d$，平衡时积分状态可以调整为 $z=(11-d)/6$，而输出仍为1。这个结论假设执行器能够提供所需补偿且闭环结构保持稳定。误差积分器使常值误差无法与有限的稳态积分状态同时存在，从而提供消除偏差的调节机制。

### 适用条件与边界

仅在原对象上盲目添加积分器可能使闭环失稳。必须连同反馈增益一起检查增广闭环极点；只有平衡存在且闭环稳定，稳态推理才成立。执行器饱和时积分状态可能继续积累，理想线性分析不再完整，需要考虑相应约束与抗积分饱和设计。

单个积分器对应常值信号类别，不保证对任意频率正弦参考零误差。固定频率正弦信号的生成器包含一对虚轴模态，相关鲁棒调节需要适当的振荡内模及稳定性条件。也不能由某个精确模型上前馈恰好消除误差，就推断已经具备面对模型扰动的鲁棒内模结构。

在本例中，积分器与状态反馈共同构成完整设计。若状态只能估计，还需满足相应可检测条件并检查组合闭环。此卡的数值例说明机制和条件，不构成对任意未知对象或任意扰动的无条件补偿承诺。

### 常见误区

1. 认为控制器中出现积分器就必然闭环稳定且零误差。
2. 把参考的拉普拉斯表达式直接相乘当成内模原理。
3. 用单个积分器承诺跟踪任意时变信号。

### 自检

1. 本例为何稳态时必有 $y=r$？
2. 输入常值扰动d由哪个变量的平衡值变化补偿？

**核对要点**：有限平衡要求 $\dot z=r-y=0$，且闭环稳定保证收敛；积分状态z调整为 $(11-d)/6$。

### 关联节点

- **环路增益**（无向，关系：相关）
- **环路增益 L（s）**（无向，关系：相关）
