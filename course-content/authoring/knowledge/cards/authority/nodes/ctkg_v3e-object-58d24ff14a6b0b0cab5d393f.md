---
node_id: ctkg_v3e-object-58d24ff14a6b0b0cab5d393f
authority_entity_id: "ctkg:v3e-object-58d24ff14a6b0b0cab5d393f"
name: "傅里叶系数"
name_en: "Fourier Coefficient"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-5f47b7d053b556435a3b0dde91a9b20c368999d87979b4e7b463f0675d52a545.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-5f47b7d053b556435a3b0dde91a9b20c368999d87979b4e7b463f0675d52a545.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-58d24ff14a6b0b0cab5d393f.md"
asset_refs: []
---

## 首页

# 傅里叶系数 | Fourier Coefficient

**一句话定义**：周期信号第 k 次谐波的复系数，同时编码该谐波的幅值和相位。

**核心直觉**：双边复系数表示单条频率线；对实信号，正负频率配对后的第 $k>0$ 次谐波幅值为 $2|c_k|$。

**关键公式**：
$$
c_k=\frac{1}{T}\int_0^T x(t)e^{-jk\omega_0t}\,dt,\qquad \omega_0=\frac{2\pi}{T}
$$

**学习目标**：由积分或已知正弦展开求出 c_k，并保留复数相位。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

傅里叶系数依赖所选周期 $T$ 和基频 $\omega_0=2\pi/T$。在双边复指数展开 $x(t)=\sum_{k=-\infty}^{\infty}c_ke^{jk\omega_0t}$ 中，$c_k$ 是第 $k$ 条频率线的复权重。对实信号有 $c_{-k}=c_k^*$，所以正负频率线必须成对解释。

对 $k>0$，配对后得到 $c_ke^{jk\omega_0t}+c_k^*e^{-jk\omega_0t}=2|c_k|\cos(k\omega_0t+\arg c_k)$。因此双边频率线的系数模是 $|c_k|$，对应实余弦谐波的幅值是 $2|c_k|$，相位是 $\arg c_k$。直流分量 $c_0$ 不翻倍；若信号本身为复值，也不能套用实信号共轭配对。

使用三角形式 $a_k\cos(k\omega_0t)+b_k\sin(k\omega_0t)$ 时，$c_k=(a_k-jb_k)/2$。先说明采用双边系数还是实谐波幅值，再比较谱图，才能避免相差一倍的误判。

### 教学计算/推理例

取 $x(t)=2\cos t+\sin 2t$、$T=2\pi$。欧拉展开得 $c_1=c_{-1}=1$，$c_2=-j/2$、$c_{-2}=j/2$。第一实谐波的幅值为 $2|c_1|=2$；第二实谐波的幅值为 $2|c_2|=1$，余弦相位为 $-\pi/2$，正好对应 $\sin 2t$。

### 适用条件与边界

要求信号确实按 T 周期扩展并采用复指数归一化。使用三角级数的 a_k、b_k 时要先转换约定。

### 自检

1. $x(t)=2\cos t$ 的 $c_1$ 是多少？对应实谐波的幅值是多少？
2. 实信号的 $c_2=-j/2$ 时，双边系数模和第二实谐波幅值分别是多少？

**核对要点**：$c_1=1$，实谐波幅值为 $2$；系数模为 $0.5$，实谐波幅值为 $1$，因为需要合并正、负频率两条共轭频率线。

### 关联节点

- 当前权威邻域仅返回该节点本身，未添加推测关系。
