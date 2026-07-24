---
node_id: 终值定理_7_0adf63db
name: 终值定理
category: 概念性
bloom_level: 应用
chapter: 7
tags:
- 序列终值
- 稳态误差
- 稳态值
- 极限
- z变换
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# 终值定理

**一句话定义**：z变换的基本定理，用于求取离散时间序列当时间趋于无穷时的终值，在离散系统分析中常用于求稳态误差。

**关键公式**：

$$
x(\infty) = \lim_{z \to 1} (1-z^{-1})X(z)
$$

$$
\lim_{n \to \infty} x[n] = \lim_{z \to 1} (1-z^{-1})X(z)
$$

## 详情

### 完整解释

z变换的基本定理，用于求取离散时间序列当时间趋于无穷时的终值，在离散系统分析中常用于求稳态误差。

### 典型示例

- 设X(z)=0.792z^2/((z-1)(z^2-0.416z+0.208))，利用终值定理得x(\infty)=1。
- 确定函数的终值

### 关键词

序列终值、稳态误差、稳态值、极限、z变换
