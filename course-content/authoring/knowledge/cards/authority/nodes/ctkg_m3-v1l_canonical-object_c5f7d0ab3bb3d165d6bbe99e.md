---
node_id: ctkg_m3-v1l_canonical-object_c5f7d0ab3bb3d165d6bbe99e
authority_entity_id: "ctkg:m3-v1l:canonical-object:c5f7d0ab3bb3d165d6bbe99e"
name: "开环传递函数"
name_en: "Open-Loop Transfer Function"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8a3cd227c0e70a06edef507583f805a5f511d99647cdfd129631e6a54b1a0840.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8a3cd227c0e70a06edef507583f805a5f511d99647cdfd129631e6a54b1a0840.json"
asset_refs: []
---

## 首页

# 开环传递函数 | Open-Loop Transfer Function

**一句话定义**：沿前向链与反馈测量链绕一圈所得的完整环路传递函数。

**核心直觉**：前向通路只描述控制器和对象的串联；完整环路还要乘上反馈通路 $H(s)$。

**关键公式**：$L(s)=F(s)H(s)$，闭环参考通道为 $T(s)=F(s)/(1+L(s))$。

**学习目标**：明确前向通路、完整环路和闭环参考传递函数的不同角色。

---

## 详情

### 完整解释

在负反馈结构中，开环传递函数应先说明所采用的边界。本卡把控制器和对象的串联称为前向传递函数 $F(s)$，把沿完整环路再经过测量反馈通路 $H(s)$ 的乘积称为开环环路传递函数 $L(s)$：
$$
L(s)=F(s)H(s)。
$$
当反馈不是单位反馈时，$F(s)$ 与 $L(s)$ 不是同一个量。闭环从参考输入到输出的通道还要按负反馈关系写成 $T(s)=F(s)/(1+L(s))$，不能直接把闭环参考传函误称为开环传函。

### 教学计算/推理例

取控制器 $2/(s+2)$、对象 $1/(s+1)$，前向传递函数为
$$
F(s)=\frac{2}{(s+2)(s+1)}。
$$
当 $H(s)=1$ 时，完整环路 $L(s)=F(s)$，闭环参考通道为
$$
T(s)=\frac{2}{s^2+3s+4}。
$$
当 $H(s)=0.5$ 时，完整环路变为
$$
L(s)=\frac{1}{(s+2)(s+1)},
$$
但前向通路仍然是同一个 $F(s)$，闭环参考通道为
$$
T(s)=\frac{2}{s^2+3s+3}。
$$
两个例子的分母不同，正是反馈测量增益进入完整环路后的结果。

这些 $T(s)$ 都描述参考输入到输出的绝对通道；若改成扰动到输出或测量噪声到输出，分子和边界也会随通道改变。因此“开环传递函数”必须和输入输出定义一起使用。

### 适用条件与边界

本例采用线性定常、负反馈、零初始条件和标量串联模型。公式中的 $1+L(s)$ 对应负反馈约定；正反馈需要改变特征关系。单位反馈时 $H=1$ 让 $F$ 与 $L$ 数值相同，但这是特例，不能推广到一般测量反馈。

### 常见误区

1. **误区**：开环传递函数永远等于控制器乘对象，反馈通路可以忽略。**纠正**：控制器乘对象是前向 $F(s)$；完整环路是 $L(s)=F(s)H(s)$。
2. **误区**：闭环参考通道总能写成 $L(s)/(1+L(s))$。**纠正**：一般参考通道是 $F(s)/(1+L(s))$，只有 $H=1$ 时两者才数值相同。

### 自检

1. 当 $H(s)=0.5$ 时，前向通路和完整环路分别是什么？
2. 为什么两个反馈取值会得到不同的闭环分母？

**核对要点**：前向通路仍为 $2/[(s+2)(s+1)]$，完整环路为 $1/[(s+2)(s+1)]$；$H$ 进入 $1+F H$，所以闭环特征分母从 $s^2+3s+4$ 变为 $s^2+3s+3$。

### 关联节点

- **等效开环传递函数**（出边，关系：前置于）
- **单位反馈系统**（无向，关系：相关）
- **增益损失**（无向，关系：相关）
- **负反馈连接结构**（无向，关系：相关）
- **回路传递函数**（无向，关系：相关）
- **线性时不变系统**（无向，关系：相关）
- **负反馈回路**（无向，关系：相关）
- **传递函数**（出边，关系：属于）
- $\Phi(s)=\frac{G(s)}{1+G(s) H(s)}$（入边，关系：推导自）
- **等效开环传递函数**（入边，关系：属于）
