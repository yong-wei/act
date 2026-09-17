---
node_id: ctc_modeling-47e8eb68c1aa5cd068c72e54
authority_entity_id: "ctc:modeling-47e8eb68c1aa5cd068c72e54"
name: "负反馈回路"
name_en: "Negative Feedback Loop"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-2e8353b8122d2d36660d2aa84f583f82939f83916e887b4b117f126c50343b62.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-2e8353b8122d2d36660d2aa84f583f82939f83916e887b4b117f126c50343b62.json
  - course-content/authoring/knowledge/cards/nodes/负反馈_1_0cffeeab.md
asset_refs: []
---

## 首页

# 负反馈回路 | Negative Feedback Loop

**一句话定义**：在比较点用参考信号减去反馈信号，并由所得误差驱动前向通路的闭环结构。

**核心直觉**：反馈符号规定如何比较，整个环路的动态才决定能否稳定纠偏。

**关键公式**：
$$
E=R-HY,\qquad Y=GE\quad\Longrightarrow\quad\Phi=\frac{G}{1+GH}.
$$

**学习目标**：从信号方程推导闭环关系，避免仅凭负号判断稳定性。

---

## 详情

### 完整解释

#### 用方程确定反馈符号

本卡把前向通路合写为 $G(s)$，测量通路写为 $H(s)$，比较点明确采用相减。将 $Y=G(R-HY)$ 整理得 $(1+GH)Y=GR$，所以分母为 $1+GH$。若图中把负号已经计入反馈支路增益，则通用回路公式的写法会不同；不能在没有说明符号约定时机械记忆“正号或负号”。

参考 $r$、输出 $y$ 与测量值 $y_m$ 也应区分。$H=1$ 时，比较点误差 $e=r-y$ 就是跟踪误差；非单位测量时则为 $e=r-y_m$，不能直接把它当成真实输出偏差。

#### 一个可以检查的教学模型

令 $G(s)=2/(s+1)$、$H(s)=1$，则 $\Phi(s)=2/(s+3)$。单位阶跃参考下，零初始状态的输出为
$$
y(t)=\frac23(1-e^{-3t}).
$$
稳态输出为 $2/3$，误差为 $1/3$。负反馈提高了这个模型的响应衰减速度，却没有消除静差；“有负反馈”不等于“精确跟踪”。

如果测量端叠加噪声 $n$，令 $e=r-Hy-n$，则噪声到输出的通道为 $-G/(1+GH)$。参考跟踪、对象入口扰动和测量噪声是不同通道，不能共用一个分子。

#### 动态可能改变纠偏方向

高频相位滞后可能使原本的负反馈在某些频段接近再生作用。例如教学环路 $G=K/(s+1)^3$、$H=1$ 的闭环特征多项式为 $s^3+3s^2+3s+1+K$。当 $K>8$ 时有右半平面根，虽然比较点仍画着减号，闭环已经失稳。

这正是负反馈回路与伯德图、奈奎斯特图、相角裕度和劳斯表之间的联系：结构给出方程，分析方法判断方程的根与频率性质。

#### 自检

1. 为什么本卡的负反馈分母是 $1+GH$？
2. $G=2/(s+1)$ 的例子可以说明所有负反馈系统都稳定吗？

**核对要点**：来自明确定义的两条信号方程；一个稳定例子不能替代一般判稳。

### 关联节点

- **图谱关联**：正反馈内回路、开环传递函数。
- **学习延伸**：传递函数负责建式，稳态误差评价精度，稳定性方法检查动态。这里的阅读顺序不改变图谱先修边。
