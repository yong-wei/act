---
node_id: 死区饱和非线性_8_e04bd4bd
name: 死区饱和非线性
category: 概念性
bloom_level: 应用
chapter: 8
tags:
- 分段线性
- 死区
- 饱和
- 描述函数
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# 死区饱和非线性

**一句话定义**：一种分段线性非线性特性，包含输入信号低于某阈值无输出（死区）和高于某阈值输出饱和的区域。

**关键公式**：

$$
y = \begin{cases} 0, & |x| \le \Delta \\ k(x - \Delta \text{sgn}(x)), & \Delta < |x| < a \\ M \text{sgn}(x), & |x| \ge a \end{cases}
$$

$$
N(A) = \frac{2k}{\pi}\left[ \arcsin\frac{a}{A} - \arcsin\frac{\Delta}{A} + \frac{a}{A}\sqrt{1-(\frac{a}{A})^2} - \frac{\Delta}{A}\sqrt{1-(\frac{\Delta}{A})^2} \right], \, A \ge a
$$

## 详情

### 完整解释

一种分段线性非线性特性，包含输入信号低于某阈值无输出（死区）和高于某阈值输出饱和的区域。

### 典型示例

- 图 8-37 展示了死区饱和特性及其正弦响应。
- 当 Δ=0 时，退化为饱和特性；当 a→∞ 时，退化为死区特性。

### 关键词

分段线性、死区、饱和、描述函数
