---
node_id: 线性二次型最优控制问题_10_1ffa9fde
name: 线性二次型最优控制问题
category: 概念性
bloom_level: 理解
chapter: 10
tags:
- 性能指标
- 最优控制
- 状态调节器
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# 线性二次型最优控制问题

**一句话定义**：在系统状态或输出偏离平衡状态时，寻找控制向量使性能指标极小化的一类最优控制问题。

**关键公式**：

$$
J = \int_{t_0}^{t_f} (x^T Q x + u^T R u) dt + x^T(t_f) F x(t_f)
$$

## 详情

### 完整解释

在系统状态或输出偏离平衡状态时，寻找控制向量使性能指标极小化的一类最优控制问题。

### 典型示例

- 输出调节器问题
- 输出跟踪系统问题

### 关键词

性能指标、最优控制、状态调节器
