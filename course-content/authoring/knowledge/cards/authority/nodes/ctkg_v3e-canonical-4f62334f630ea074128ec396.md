---
node_id: ctkg_v3e-canonical-4f62334f630ea074128ec396
authority_entity_id: "ctkg:v3e-canonical-4f62334f630ea074128ec396"
name: "单位阶跃函数"
name_en: "Unit-Step Function"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c442c60900347aa944be2e2723cd4f1a0d48415342e2595919b9099cc387ff6c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c442c60900347aa944be2e2723cd4f1a0d48415342e2595919b9099cc387ff6c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01c/previous/ctkg_v3e-canonical-4f62334f630ea074128ec396.md"
asset_refs: []
---

## 首页

# 单位阶跃函数 | Unit-Step Function

**一句话定义**：在 $t=0$ 从零跃变到一的标准因果输入，记为 $u(t)$。

**核心直觉**：它给系统一个瞬时而明确的目标变化，用来观察跟踪和动态过程。

**关键公式**：
$$
u(t)=\begin{cases}0,&t<0\\1,&t>0\end{cases},\qquad \mathcal{L}\{u(t)\}=\frac1s
$$

**学习目标**：区分单位与幅值、函数与响应，并正确处理延迟、量纲和 $t=0$ 约定。

**关联**：典型输入信号 · 单位阶跃响应 · 一阶系统的单位阶跃响应

---

## 详情

### 完整解释

单位阶跃函数是输入信号，不是系统的输出曲线。对理想因果信号，$u(t)=0$（$t<0$），$u(t)=1$（$t>0$）。$u(0)$ 可以按课程约定取 $0$、$1/2$ 或 $1$；单边拉普拉斯积分中单个时间点不改变普通积分值，但在描述开关瞬间、冲击和初始条件时应把约定说清楚。函数本身无量纲，幅值和物理单位由乘在它前面的系数携带。

幅值为 $A$ 的阶跃写成 $r(t)=A u(t)$，其拉普拉斯变换是 $R(s)=A/s$。因此“单位”只表示 $A=1$，不是说输出一定等于一，也不是说输入的物理单位消失。理想阶跃的分布导数是冲激 $\delta(t)$；阶跃与冲激是相关但不同的测试信号。

延迟阶跃写成 $u(t-\tau)$，其中 $\tau>0$ 是时间，
$$
\mathcal{L}\{u(t-\tau)\}=\frac{e^{-\tau s}}s.
$$
指数中的乘积 $\tau s$ 无量纲；写成 $e^{-\tau}/s$ 会丢失复频域变量，也不能表达时间移位。通过稳定线性系统后，延迟通常使响应向右移动，而不凭空改变静态增益。

### 教学计算/推理例

取一个幅值为 $3\,\mathrm{V}$、延迟 $\tau=0.2\,\mathrm{s}$ 的阶跃：
$$
r(t)=3u(t-0.2),\qquad R(s)=\frac{3e^{-0.2s}}s.
$$
通过零初态的一阶对象 $G(s)=1/(0.5s+1)$，输出为
$$
y(t)=3\left[1-e^{-2(t-0.2)}\right]u(t-0.2).
$$
在 $t=0.1\,\mathrm{s}$ 时 $y=0$；在 $t=0.7\,\mathrm{s}$ 时，$y=3(1-e^{-1})\approx1.8964\,\mathrm{V}$。这里的幅值和时间单位均保留在信号定义与响应中。

### 适用条件与边界

本卡采用理想、因果、连续时间阶跃和零初始条件。实际命令可能有有限上升时间、采样边沿、饱和或速率限制，此时应把实际输入波形作为模型的一部分。$t=0$ 的单点取值不影响普通拉普拉斯积分，却可能影响含冲击的严格推导。

### 常见误区

1. **误区**：单位阶跃函数就是单位阶跃响应，或其输出终值一定为一。**纠正**：函数是输入 $u(t)$，响应由系统传递函数决定；输入幅值为一不约束通道的直流增益。
2. **误区**：延迟阶跃的变换是 $e^{-\tau}/s$，或延迟只是把输入减去一个常数。**纠正**：正确变换为 $e^{-\tau s}/s$，时域信号是 $u(t-\tau)$。

### 自检

1. 幅值为 $2$ 的阶跃 $2u(t)$ 的拉普拉斯变换是什么？
2. 为什么 $u(t-0.2)$ 在 $t=0.1$ 时为零？

**核对要点**：变换为 $2/s$；因为延迟阶跃尚未到达，$t<0.2$ 时按定义仍为零。

### 关联节点

- **典型输入信号**（包含）：单位阶跃是典型输入家族的一员。
- **单位阶跃响应**（导出）：将该函数送入系统得到单位阶跃响应。
- **一阶系统的单位阶跃响应**（相关）：一阶对象提供可解析的响应例子。
- **高阶系统解析阶跃响应**（相关）：高阶对象可用同一输入比较模态。
- **单位阶跃响应曲线**（相关）：把响应显示为时间曲线。
