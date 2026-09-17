---
node_id: ctkg_v3e-object-27e0a7e37803fbebc1b6f65a
authority_entity_id: "ctkg:v3e-object-27e0a7e37803fbebc1b6f65a"
name: "对数幅相曲线"
name_en: "Log-Magnitude–Phase Curve"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-5c243668741e116712047b05b90ae1b6e38717b99d683934190b0ec70fd82277.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-5c243668741e116712047b05b90ae1b6e38717b99d683934190b0ec70fd82277.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-24a/previous/ctkg_v3e-object-27e0a7e37803fbebc1b6f65a.md"
asset_refs: []
---

## 首页
# 对数幅相曲线 | Log-Magnitude–Phase Curve

一句话定义：对数幅相曲线以相位为横坐标、分贝幅值为纵坐标，频率为参变量，常称尼科尔斯曲线。

- 两个坐标轴都按线性数值分度。
- 名称中的“对数”指幅值转成分贝，不指频率横轴。
- 曲线上的点应标注频率，才能知道响应随频率如何变化。

---
## 详情
### 完整解释

对每个频率计算 $\varphi(\omega)=\arg G(j\omega)$ 和 $L(\omega)=20\log_{10}|G(j\omega)|$，然后绘制点 $(\varphi,L)$。频率不再是一条坐标轴，而是确定曲线上各点的参变量。它把同一个复数响应的模和辐角放在同一张图中，便于结合闭环等幅、等相位网格分析控制设计。

本卡所指对数幅相曲线与伯德图必须区分：伯德图的两幅曲线都以对数频率为横轴；这里横轴直接是角度。图上横向等距离表示相同角度差，纵向等距离表示相同分贝差，因此两轴数值本身均为线性分度。

### 教学计算/推理例

取 $G=2/(s+1)$，令 $\omega$ 从0增大。在1 rad/s处 $G(j)=1-j$，因此曲线经过 $(-45^\circ,3.0103\,\mathrm{dB})$；在10 rad/s处约经过 $(-84.2894^\circ,-14.0226\,\mathrm{dB})$。频率趋近0时趋于 $(0^\circ,6.0206\,\mathrm{dB})$；频率增大到无穷时，相位趋于 $-90^\circ$，分贝幅值趋于负无穷。

在正频率分支上，令 $\varphi=-\arctan\omega$，则 $\cos\varphi=1/\sqrt{1+\omega^2}$，可消去频率得到

$$
L=20\log_{10}(2\cos\varphi),\qquad -90^\circ<\varphi\le0^\circ.
$$

例如代入 $-45^\circ$ 就得到3.0103 dB。该关系给出曲线形状，但频率标注仍有教学价值，因为不同系统可能在相似坐标位置对应不同频率。

### 适用条件与边界

若将 $G$ 视为单位负反馈的开环传递函数，复平面临界点 $-1$ 对应 $0$ dB及 $-180^\circ$（或相差整周的角度）。这是特定反馈结构下的临界位置；不能仅看曲线某点离它远近就代替完整稳定判据。连续相位可能跨越多周，应保持分支一致，避免主值跳变造成错误连线。幅值为零的点不能用有限分贝坐标表示。

### 常见误区

1. 把横轴标成 $\log\omega$，却仍称其为本定义下的幅相曲线。
2. 将0 dB理解为零幅值。它对应单位幅值比。
3. 在相位主值从 $-180^\circ$ 跳到 $180^\circ$ 时直接横跨图面连线，误画连续分支。

### 自检

1. 本例在1 rad/s处的三个量：相位、分贝幅值、频率，哪两个用于坐标？
2. 如果使用相位的另一分支，临界复数 $-1$ 的相位是否只能写成 $-180^\circ$？

**核对要点**：相位横坐标、分贝幅值纵坐标，频率作为点的标记；$180^\circ$ 以及相差360度整数倍的角度也表示同一方向，应全图一致处理。

### 关联节点

- **对数幅相图绘制**（无向，关系：相关）
