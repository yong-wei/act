---
node_id: ctc_modeling-71f0e8d834291c2c7d5e25b9
authority_entity_id: "ctc:modeling-71f0e8d834291c2c7d5e25b9"
name: "严格真传递函数系统"
name_en: "Strictly Proper Transfer Function System"
category: 概念性
knowledge_type: C
bloom_level: 理解
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-fc3f52fca18dea8d4e4129002525ced2bcd65eddcc106e009b9cd1e5c3649c1d.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-fc3f52fca18dea8d4e4129002525ced2bcd65eddcc106e009b9cd1e5c3649c1d.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-08a/previous/ctc_modeling-71f0e8d834291c2c7d5e25b9.md"
asset_refs: []
---

## 首页

# 严格真传递函数系统 | Strictly Proper Transfer Function System

**一句话定义**：在标准有限维状态空间模型中，输出方程的直接馈通矩阵 $D$ 恒为零的系统。

**核心直觉**：$D$ 决定输入能否瞬时跳到输出；$D=0$ 只表示没有直接通道，不表示输出恒为零。

**关键公式**：
$$
G(s)=C(sI-A)^{-1}B, D=0
$$

**学习目标**：从 $D$ 判断严格真传递性质，并正确解释阶跃开始时的绝对输出。

---

## 详情

### 完整解释

在线性定常、有限维、标准因果状态空间模型中，状态方程和输出方程写成
$$
\dot{x}(t)=Ax(t)+Bu(t),\qquad y(t)=Cx(t)+Du(t)。
$$
这里的 $D$ 是输入到输出的直接馈通项。$D=0$ 时，当前输入先改变状态导数，再由状态影响输出；在零初始条件下，传递函数为
$$
G(s)=C(sI-A)^{-1}B。
$$
因此高频极限为零，输入输出传递函数是严格真有理的。这个判断依赖“标准有限维状态空间”边界；它不是对描述子系统或其他广义模型的无条件断言。

### 教学计算/推理例

固定模型取 $A=-1$、$B=1$、$C=2$、$D=0$，并从零初始状态施加单位阶跃输入。得到
$$
G(s)=\frac{2}{s+1},\qquad y(t)=2(1-e^{-t}),\qquad t\ge 0。
$$
这里的 $y(t)$ 是输出的绝对量：$y(0^+)=0$，并且 $y(t)$ 趋于 $2$；它不是另写的增量变量。高频极限为 $0$，只说明输入不能通过 $D$ 直接跳到输出。

作对照，若只把直接馈通改为 $D=1$，则
$$
G(s)=1+\frac{2}{s+1},\qquad y(t)=3-2e^{-t}。
$$
此时阶跃输出在 $0^+$ 发生大小为 $1$ 的直接跳变。动态部分仍由同一个状态模型贡献，变化来自直接通道。

### 适用条件与边界

本例假定零初始状态、单位阶跃、连续时间和线性定常模型。改变初始状态会增加零输入响应，改变输入也会改变输出数值，但不会把 $D=0$ 变成直接馈通。若要判断某个广义状态空间或含冲激的模型，必须另行说明模型类别，不能只套用本卡结论。

### 常见误区

1. **误区**：$D=0$ 意味着 $y(t)$ 始终为零。**纠正**：它只去掉直接馈通；本例的状态通道仍给出 $y(t)=2(1-e^{-t})$。
2. **误区**：严格真传递函数意味着阶跃最终值也为零。**纠正**：高频极限为零与零频率的稳态增益是两件事，本例稳态输出为 $2$。

### 自检

1. 本例为什么在阶跃开始时没有直接跳变？
2. 若把 $D$ 改为 $1$，哪个量在 $0^+$ 发生变化？

**核对要点**：因为 $D=0$ 没有输入到输出的瞬时项；改为 $D=1$ 后，输出绝对量在 $0^+$ 增加大小为 $1$ 的跳变。

### 关联节点

本卡的捕获邻域没有提供可渲染的关系边，因此不添加推测关联。
