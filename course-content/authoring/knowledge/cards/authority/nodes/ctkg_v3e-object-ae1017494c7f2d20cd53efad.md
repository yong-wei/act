---
node_id: ctkg_v3e-object-ae1017494c7f2d20cd53efad
authority_entity_id: "ctkg:v3e-object-ae1017494c7f2d20cd53efad"
name: "自激振荡"
name_en: "Self-Excited Oscillation"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-08da7b6837a32e4973f38b240da6dc6502a10bd2503522253d5d09d4f3d0127b.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-08da7b6837a32e4973f38b240da6dc6502a10bd2503522253d5d09d4f3d0127b.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-28a/previous/ctkg_v3e-object-ae1017494c7f2d20cd53efad.md"
asset_refs: []
---

## 首页
# 自激振荡 | Self-Excited Oscillation

一句话定义：自激振荡是在没有外部周期激励时，由系统内部反馈与能量交换形成的持续振荡，稳定情形具有由系统决定的振幅和频率。

- 没有外部周期信号不等于没有能源供给。
- 自激振荡应与强迫振荡和衰减暂态区分。
- 稳定极限环是描述自治系统稳定自激运动的常见方式。

---
## 详情
### 完整解释

外部正弦信号驱动的周期响应属于强迫振荡；初始扰动引起后逐渐消失的振荡属于暂态。自激振荡的周期行为由内部动力机制维持，不需要外部周期参考逐次推动。实际装置仍可能从电源、流体或其他能源获得能量，因此“自激”不能解释为无能量输入而持续耗散。

在自治非线性系统中，稳定极限环提供一种典型机制：小振幅时轨迹向外增长，大振幅时向内收缩，最终趋于一个孤立周期轨道。系统的稳态振幅可对初始幅值不敏感，而相位仍可能由初始条件决定。

### 教学计算/推理例

考虑 $\dot x=(1-r^2)x-y$、$\dot y=x+(1-r^2)y$，其中 $r^2=x^2+y^2$。无外部周期输入，径向方程为 $\dot r=r(1-r^2)$，角速度为1。非零半径小于1时增长，大于1时下降，最后趋于振幅半径1、周期 $2\pi$ 的运动。

用 $V=r^2/2$ 作为振幅平方量，可得

$$
\dot V=r\dot r=r^2(1-r^2).
$$

小半径时该量增加，大半径时减少，环上保持不变。它展示了内部增幅与抑制的平衡。这里 $V$ 是数学状态量，未指定物理单位时不能直接称其为某装置的真实焦耳能量。

从原点严格出发时，两个状态导数均为0，仍停在平衡点；非零微扰会改变这一情形。因此不能声称该模型任何初态都立即开始振荡。稳定轨道的周期由角速度决定，初始相位不同不会改变最终轨道半径。

### 适用条件与边界

并非所有非线性系统都有自激振荡，也并非观察到一段近似周期数据就证明存在稳定极限环。需要排除外部周期输入、暂态及测量伪象，并研究轨道附近的行为。多稳态系统可能只在某些初态范围内趋于周期运动。

描述函数法可提供自激振荡候选，但基波近似不等于存在性证明。摩擦、饱和和继电等元件也不能单独决定整个系统是否自激，必须考虑完整反馈动力学及能量来源。设计中可能希望避免这种运动，也可能有意利用振荡，评价应服从具体任务。

### 常见误区

1. 把任何周期响应都叫自激振荡，不核对外部激励。
2. 把“无外部周期信号”理解成“无需任何能源”。
3. 由某一稳定周期轨道推断所有初态和所有参数都具有同样行为。

### 自检

1. 本例半径0.5与2的初态为何都能趋向半径1？
2. 从严格原点出发，是否按同样路径逐渐振荡起来？

**核对要点**：径向速度在内侧为正、外侧为负；原点是平衡点，严格保持原点，需要区分非零扰动情形。

### 关联节点

- **正阻尼**（无向，关系：相关）
- **振荡周期**（无向，关系：相关）
- **继电特性**（无向，关系：相关）
