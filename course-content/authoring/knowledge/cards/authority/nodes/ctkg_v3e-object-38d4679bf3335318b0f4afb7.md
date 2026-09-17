---
node_id: ctkg_v3e-object-38d4679bf3335318b0f4afb7
authority_entity_id: "ctkg:v3e-object-38d4679bf3335318b0f4afb7"
name: "频率特性"
name_en: "Frequency Characteristic"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-ebd0d8336c3cd53d34b2abd2840d7cb2b6b7fe2f0a394d0887b77d3c77588db3.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-ebd0d8336c3cd53d34b2abd2840d7cb2b6b7fe2f0a394d0887b77d3c77588db3.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01e/previous/ctkg_v3e-object-38d4679bf3335318b0f4afb7.md"
asset_refs: []
---

## 首页

# 频率特性 | Frequency Characteristic

**一句话定义**：系统在每个正弦频率上的复数增益，由同频输出与输入的幅值比和相位差共同组成。

**核心直觉**：幅频特性回答“放大多少”，相频特性回答“相位差多少”，频率特性把两者合成一个复数点。

**关键公式**：
$$
G(j\omega)=A(\omega)e^{j\varphi(\omega)},\qquad A(\omega)=|G(j\omega)|
$$

**学习目标**：从一个频率点的幅值和相位构造复数频率特性，并区分单点、曲线与传递函数。

## 详情

### 完整解释

频率特性是频率响应的复数表示。固定 $\omega$ 时，同频稳态复幅值之比 $Y_{\mathrm{ss}}/U$ 的模 $A(\omega)$ 是幅值比，辐角 $\varphi(\omega)$ 是相位差。改变 $\omega$ 后，复数点连成曲线，可用幅相图、伯德图或极坐标图观察。

这里的“特性”不是随时间变化的输出曲线，也不是任意信号的傅里叶幅值，而是选定通道的正弦稳态比值。稳定 LTI 才能用 $s=j\omega$ 得到它；不稳定、未稳态或饱和时，代入的复数不能自动成为可测频率特性。若输出写成 $\sin(\omega t-\theta)$，$\theta>0$ 表示滞后，相位就是 $-\theta$。

固定输入、零初态算例仍取 $\dot y+y=u$、$y(0)=0$、$u(t)=2\sin t$。在 $\omega=1\ \mathrm{rad/s}$，$G(j)=0.5-j0.5$，所以 $A=\sqrt{0.5^2+(-0.5)^2}=0.7071$，$\varphi=\operatorname{atan2}(-0.5,0.5)=-45^\circ$。同一个结果写成极坐标是 $0.7071\angle-45^\circ$，写成时间信号则是稳态输出 $\sqrt2\sin(t-\pi/4)$；笛卡尔坐标、极坐标和时域写法只是同一频率点的三种读法。

图谱中，频率特性分解为幅频特性和相频特性，并由“频率特性实验确定方法”获得；完整曲线需要多个频率点，不能由一个点臆测。

### 教学计算/推理例

另一待测通道在 $\omega=1\ \mathrm{rad/s}$ 测得幅值比 $A=0.5$、相位差 $-60^\circ$，系统从零初态开始。复数频率特性为 $0.5e^{-j\pi/3}=0.25-j0.4330$；实部、虚部的符号只表示相位象限。

### 适用条件与边界

必须固定通道、输入频率和相位参考，并在稳定 LTI 的稳态窗口内取同频分量。多输入多输出系统需注明输入输出端口；非线性对象的比值可能依赖激励幅值，不能不加说明地称为单一频率特性。

### 常见误区

1. 只记录 $A(\omega)$ 就称得到了完整频率特性。没有相位，复数点的位置和时域滞后都不确定。
2. 看到 $-60^\circ$ 就写成 $-60\ \mathrm{rad}$，或用普通反正切丢掉象限。计算相位时应保留弧度/角度转换并优先使用象限正确的辐角。

### 自检

1. $0.5\angle-60^\circ$ 的实部约是多少？
2. 一个频率点能否确定系统完整的频率特性曲线？

**核对要点**：实部约为 $0.25$；不能，至少需要多个频率点及其测量边界。

### 关联节点

- **幅频特性**（无向，关系：相关）
- **相频特性**（无向，关系：相关）
- **频率特性实验确定方法**（入边，关系：适用于）
- **期望的开环频率特性形状**（无向，关系：相关）
- **绘制概略开环幅相特性曲线方法**（入边，关系：用于分析）
