---
node_id: ctkg_v3e-object-3af39a858b2949296df5387f
authority_entity_id: "ctkg:v3e-object-3af39a858b2949296df5387f"
name: "幅值谱"
name_en: "Amplitude Spectrum"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-25167c5f2ebfd993ed25f345d528af58af9f2c273a2c7d552fd96bb66d3d4a4c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-25167c5f2ebfd993ed25f345d528af58af9f2c273a2c7d552fd96bb66d3d4a4c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01e/previous/ctkg_v3e-object-3af39a858b2949296df5387f.md"
asset_refs: []
---

## 首页

# 幅值谱 | Amplitude Spectrum

**一句话定义**：周期信号的傅里叶复系数按频率排列后的幅值集合，显示各谐波有多强。

**核心直觉**：幅值谱是信号本身的指纹，不是系统的频率响应；它只保留谱线高度，不能单独恢复相位。

**关键公式**：
$$
x(t)=\sum_{k=-\infty}^{\infty}c_ke^{jk\omega_0t},\qquad \text{双边幅值谱}=|c_k|
$$

**学习目标**：从复傅里叶系数读取双边、单边幅值谱，并正确处理正负频率与 DC 分量。

## 详情

### 完整解释

对周期为 $T$、基频为 $\omega_0=2\pi/T$ 的信号，复傅里叶系数 $c_k$ 表示 $k\omega_0$ 的复数分量，幅值谱取 $|c_k|$。实信号满足 $c_{-k}=c_k^*$，正负谱线等高，是同一实谐波的复指数分解。幅值谱只说明成分强弱，相位在 $\arg(c_k)$ 中。

双边谱保留所有 $k$，画 $|c_k|$。合并正负频率后，$k>0$ 的单边峰值幅度为 $2|c_k|$；DC 的 $c_0$ 没有伙伴，仍为 $|c_0|$，不能乘二。若纵轴是 RMS 或功率谱密度，还要改用相应归一化。

谱是给定信号的属性，改变系统不会改变输入的 $c_k$；稳定 LTI 的输出谱线才会再乘 $G(jk\omega_0)$。零初态只影响启动暂态，不改变输入系数。只有输出谱而没有输入谱时，不能把谱线高度叫作系统幅频特性。

固定输入算例取 $x(t)=1+2\cos t+\sin 2t$，从 $t=0$ 取零相位；周期为 $2\pi$，若把它送入某稳定 LTI，则系统初态取零。由指数展开，$c_0=1$，$c_{1}=c_{-1}=1$，$c_2=-j/2$，$c_{-2}=j/2$。双边幅值谱在 $0,\pm1,\pm2$ 处分别为 $1,1,0.5$；单边峰值谱在 $0,1,2$ 处分别为 $1,2,1$。这里 DC 没有加倍，基波的 $2$ 则来自正负频率合并。

图谱把幅值谱连接到“周期信号的频谱”；频率响应和幅频特性属于系统分析。先问“这是谁的属性”，再选择谱或频率响应，可避免混淆。

### 教学计算/推理例

对上例，$\sin 2t=(e^{j2t}-e^{-j2t})/(2j)$，所以两条复系数的模都为 $0.5$。单边谱的第二谐波峰值为 $2\times0.5=1$；DC 仍为 $1$。用一整周期积分得到同样的 $c_k$，比只抄峰值更能检查符号和归一化。

### 适用条件与边界

需先固定周期、基频、复系数定义和纵轴口径。非周期信号对应连续频谱；窗截断、采样和噪声会改变估计。单边谱只适用于明确合并了正负频率的约定。

### 常见误区

1. 把幅值谱当成系统频率响应。幅值谱描述信号，频率响应描述输入到输出的复数比值，两者需要不同的数据。
2. 单边谱把 DC 也乘二，或在双边谱里把正负频率再合并一次。只有 $k>0$ 的共轭对需要合并。

### 自检

1. 对 $x(t)=1+2\cos t$，双边谱的 $k=1$ 与 $k=-1$ 各是多少？
2. 为什么单边谱的 DC 分量不加倍？

**核对要点**：两条双边谱线各为 $1$；DC 只有一个零频率分量，没有共轭的正负频率对。

### 关联节点

- **周期信号的频谱**（无向，关系：相关）
- **周期信号的幅值谱为一簇谱线，随频率增大包络线衰减**（入边，关系：适用于）
