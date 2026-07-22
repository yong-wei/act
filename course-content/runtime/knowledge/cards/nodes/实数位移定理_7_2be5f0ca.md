---
node_id: 实数位移定理_7_2be5f0ca
name: 实数位移定理
category: 概念性
bloom_level: 应用
chapter: 7
tags:
- 滞后定理
- 超前定理
- 平移
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# 实数位移定理

**一句话定义**：z变换的基本定理之一，描述了采样序列在时间轴上平移（超前或滞后）后，其z变换与原序列z变换的关系。

**关键公式**：

$$
\mathcal{Z}[x(t-kT)] = z^{-k}X(z)
$$

$$
\mathcal{Z}[x(t+kT)] = z^{k}[X(z) - \sum_{n=0}^{k-1} x(nT)z^{-n}]
$$

## 详情

### 完整解释

z变换的基本定理之一，描述了采样序列在时间轴上平移（超前或滞后）后，其z变换与原序列z变换的关系。

### 典型示例

- 应用滞后定理计算e^{-a(t-T)}的z变换：\mathcal{Z}[e^{-a(t-T)}] = z^{-1} \cdot \frac{z}{z-e^{-aT}}。

### 关键词

滞后定理、超前定理、平移
