---
node_id: ctkg_v3e-object-8c4354096b719a1d5e090da4
authority_entity_id: "ctkg:v3e-object-8c4354096b719a1d5e090da4"
name: "拉普拉斯变换"
name_en: "Laplace Transform"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8656595b157ea817cf4897082d16600b7ae116697305c8e85d6ac1041cb2ff19.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8656595b157ea817cf4897082d16600b7ae116697305c8e85d6ac1041cb2ff19.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01d/previous/ctkg_v3e-object-8c4354096b719a1d5e090da4.md"
asset_refs: []
---

## 首页

# 拉普拉斯变换 | Laplace Transform

**一句话定义**：拉普拉斯变换用复指数加权，把时域信号映射为复频域函数及其收敛域。

**核心直觉**：把微分关系转换为代数关系，再用初值和反变换还原时间响应。

**关键公式**：
$$F(s)=\int_{0^-}^{\infty}f(t)e^{-st}\,dt.$$

**学习目标**：区分单边与双边约定，保留初始条件，并说明收敛域的作用。

---

## 详情

### 完整解释

上式采用控制初值问题中常用的单边约定，$s=\sigma+j\omega$。实部 $\sigma$ 提供指数加权，使某些随时间增长的信号也能变换；虚部 $\omega$ 表示振荡变化。变换不是只求一个分式，还要说明积分在哪些 $s$ 上收敛。例如 $e^{-2t}u(t)$ 的变换为 $1/(s+2)$，收敛域为 $\operatorname{Re}s>-2$。傅里叶变换与取虚轴值的关系，需要虚轴处的收敛条件，不能对所有信号直接令 $s=j\omega$。

单边变换便于处理起始状态，双边变换则把积分区间扩展到整个时间轴。双边情形下同一代数分式可对应不同时间支撑的信号，收敛域能帮助区分它们。对没有起始冲激、状态在起点连续的常规初值问题，导数性质为 $\mathcal L\{\dot y\}=sY-y(0^-)$；高阶导数还带来更多初值项。

### 教学计算/推理例

用归一化船速模型 $2\dot y+y=u$，令起始速度 $y(0^-)=1$，输入从0时刻起为常数3。假设起点没有冲激，速度连续。变换后
$$2[sY(s)-1]+Y(s)=\frac3s,$$
故
$$Y(s)=\frac{3/s+2}{2s+1}=\frac3s-\frac2{s+1/2}.$$
反变换得到 $y(t)=3-2e^{-t/2}$。在 $t=0$ 为1，$t=2\ln2$ 时为2，最终趋于3。代回原方程，$2\dot y+y$ 恒为3。若漏掉初始状态项，得到的会是 $3(1-e^{-t/2})$，虽然终值相同，却不满足题设的初始速度。

传递函数 $G(s)=1/(2s+1)$ 描述的是零状态输入输出关系。因此可以把本例分为零状态响应 $3(1-e^{-t/2})$ 与零输入响应 $e^{-t/2}$ 后相加。这样的全局联系同时解释了传递函数、初值问题和线性叠加各自承担的作用。

### 常见误区与边界

1. **误区**：任何时候都有 $Y=GU$。**纠正**：对总响应，非零初态还贡献独立项；传递函数本身以零初态定义。
2. **误区**：拉普拉斯变换一定是有理函数。**纠正**：纯延迟含 $e^{-sT}$，一般信号也可能产生非有理变换，不能都按有限极点分式处理。

### 自检

1. 本例输入改为零但初值保持1，响应是什么？
2. 为什么反变换完成后还应代回初值和原方程？

**核对要点**：响应为 $e^{-t/2}$；代回可以发现漏初值、符号和系数错误，单看终值相同不足以证明解正确。

### 关联节点

- **单边拉普拉斯变换**（关联）：本卡初值问题采用的具体约定，导数变换必须保留初值项。
- **一阶微分方程拉氏解法**（关联）：将积分定义和导数性质应用于执行器等一阶动态模型。
