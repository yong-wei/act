---
node_id: ctkg_domainconcept_0a8044ae6cb529e98bc20bca
authority_entity_id: "ctkg:domainconcept:0a8044ae6cb529e98bc20bca"
name: "测量组件（传感器）"
name_en: "Measurement Component"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c6e543214f21be2d3dca740614a8795341874b38f130f1a3374ded6dcf9ee3b1.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c6e543214f21be2d3dca740614a8795341874b38f130f1a3374ded6dcf9ee3b1.json"
asset_refs: []
---

## 首页

# 测量组件（传感器） | Measurement Component

**一句话定义**：测量组件把被测物理量转换成可供控制系统使用的信号，其静态标定和动态响应都会影响反馈。

**核心直觉**：把电压换算成角度只解决单位与灵敏度，不能自动消除测量滞后。

**关键公式**：$V(s)=H(s)\Theta(s)$，本例 $H(s)=2/(0.1s+1)\,\mathrm{V/rad}$。

**学习目标**：区分传感器灵敏度、动态滞后与噪声，确保反馈比较使用一致单位。

---

## 详情

### 完整解释

闭环控制器通常无法直接获得真实物理状态，而是使用测量组件给出的信号。传感器可能输出电压、数字读数或其他形式；控制系统需要知道这些读数对应何种物理量、采用什么尺度，以及变化时能否及时跟随。静态标定确定读数与真实量的比例或偏置，动态模型则描述随时间变化时的响应。

测量组件也可能引入噪声、饱和和漂移。它们与动态滞后是不同问题：低通动态会使快速变化的信号衰减和相位滞后，噪声是叠加在测量上的不期望成分，而漂移可能改变标定关系。建模时应按需要分别表达，不能把所有测量误差都塞进一个恒定增益。

### 教学计算/推理例

设角度传感器的理想线性模型为
$$
H(s)=\frac2{0.1s+1}\;\mathrm{V/rad},
\qquad 0.1\dot v+v=2\theta.
$$
时间按秒计。零初态下输入 $\theta=0.1\,\mathrm{rad}$ 阶跃，得到
$$
v(t)=0.2(1-e^{-10t})\,\mathrm V.
$$
最终电压为 $0.2\,\mathrm V$，在 $0.1\,\mathrm s$ 时约为 $0.126424\,\mathrm V$。将电压除以静态灵敏度 $2\,\mathrm{V/rad}$，便得到角度估计 $\hat\theta$；但它的传函仍为
$$
\frac{\hat\Theta(s)}{\Theta(s)}=\frac1{0.1s+1}.
$$
所以标定后的直流增益为 1，滞后仍然存在。在 $\omega=1\,\mathrm{rad/s}$，原测量通道幅值约为 $1.990074\,\mathrm{V/rad}$，相位约为 $-5.710593^\circ$。除以灵敏度并不会改变该相位。

### 适用条件与边界

本例只包含一阶滞后，没有添加噪声、偏置、饱和或采样延迟。角度参考和测量值必须先转换到相同单位，才能构造 $e=\theta_{\mathrm{ref}}-\hat\theta$。若直接将弧度与伏特相减，误差信号便没有一致的物理含义。改变传感器滤波可能改善噪声表现，也会改变动态，需连同闭环一起评价。

### 常见误区

1. **误区**：标定后传感器就是单位反馈。**纠正**：只有静态尺度得到修正，本例仍有一阶动态。
2. **误区**：传感器只负责显示，不影响控制。**纠正**：控制器依据测量信号行动，测量滞后与误差会进入反馈通道。

### 自检

1. 本例应把输出电压除以哪个量，才能得到弧度单位？
2. 标定后还剩下什么动态因素？

**核对要点**：除以 $2\,\mathrm{V/rad}$；时间常数 $0.1\,\mathrm s$ 及其幅值、相位变化仍然存在。

### 关联节点

- **废气传感器**（无向，关系：相关）
- **传感器噪声**（无向，关系：相关）
