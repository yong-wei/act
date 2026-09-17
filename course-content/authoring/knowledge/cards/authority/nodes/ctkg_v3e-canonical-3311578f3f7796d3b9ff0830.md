---
node_id: ctkg_v3e-canonical-3311578f3f7796d3b9ff0830
authority_entity_id: "ctkg:v3e-canonical-3311578f3f7796d3b9ff0830"
name: "时间常数"
name_en: "Time Constant"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-52cf2b998b5f5b4d9104c2cb78798f29153e7d4be9c27a7884c25edb6493d0c4.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-52cf2b998b5f5b4d9104c2cb78798f29153e7d4be9c27a7884c25edb6493d0c4.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-11a/previous/ctkg_v3e-canonical-3311578f3f7796d3b9ff0830.md"
asset_refs: []
---

## 首页

# 时间常数 | Time Constant

**一句话定义**：稳定一阶模型的时间常数决定指数响应变化的时间尺度，在一个时间常数时完成约 63.2% 的总变化。

**核心直觉**：时间常数决定变化有多快，静态增益决定最终变化有多大，两者不能混为一谈。

**关键公式**：$G(s)=K/(Ts+1)$，单位阶跃响应为 $K(1-e^{-t/T})$。

**学习目标**：由一阶响应识别时间常数，正确解释 63.2% 和调节时间近似。

---

## 详情

### 完整解释

对 $T>0$ 的标准稳定一阶模型，指数项 $e^{-t/T}$ 描述距离终值的剩余比例。时间增加一个 $T$，该比例再乘一次 $e^{-1}$。因此“一个时间常数完成约63.2%”说的是从初始值到最终值的总变化比例，不一定是输入幅度的63.2%。

时间常数由模型的动态系数决定。在特定单RC模型中可以写成 $T=RC$，但换成其他对象、加载条件或等效结构后，应重新从方程确定。不能因为看到一个RC元件，就把整个复杂系统都当成同一个一阶时间常数。

### 教学计算/推理例

取归一化模型
$$
G(s)=\frac3{2s+1},\qquad T=2,\quad K=3.
$$
零初态单位阶跃响应为 $y(t)=3(1-e^{-t/2})$，终值为3。在 $t=T=2$ 时，输出为
$$
y(T)=3(1-e^{-1})\approx1.89636.
$$
这等于最终变化3的约63.2%，不是输入1的约63.2%。如果忽略增益3，就会把纵向尺度与时间尺度混淆。

按相对终值的2%误差带定义调节时间，需要 $e^{-t/2}\le0.02$，因此
$$
t_s=-2\ln(0.02)\approx7.82405.
$$
常用近似 $4T=8$ 与它接近，但不是严格相等。在这个单调一阶响应中，一旦进入误差带便不会再次离开，因此可直接由指数误差求解。

### 适用条件与边界

上述63.2%和调节时间关系针对单一稳定一阶指数模型。含多个时间尺度、零点、延迟或振荡的系统，不能随意从某一个点套用同一公式。非零初态时，应相对于实际初始与最终值的差判断变化比例。该模型静态增益为3，并未把它当作未经放大的被动RC分压电路。

时间常数也不同于纯延迟：一阶响应从输入改变后便开始变化，而纯延迟在延迟时间内可以完全不动。若两种效应同时存在，需要分别建模。

### 常见误区

1. **误区**：到 $t=T$ 时，任何单位阶跃输出都约为0.632。**纠正**：需乘以实际总变化量，本例约1.89636。
2. **误区**：2%调节时间严格等于 $4T$。**纠正**：本例精确结果为 $-T\ln0.02$。

### 自检

1. 本例为什么要用3乘 $1-e^{-1}$？
2. 时间常数与纯延迟有什么不同？

**核对要点**：总输出变化为3；时间常数描述指数变化速率，纯延迟描述响应开始前的时间平移。

### 关联节点

- **时间常数τ1**（无向，关系：相关）
- **机电时间常数**（入边，关系：属于）
- **初始斜率求时间常数**（无向，关系：相关）
