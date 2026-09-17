---
node_id: 前馈补偿_6_3bd3eb3b
name: 前馈补偿
category: 程序性
bloom_level: 应用
chapter: 6
tags:
- 误差全补偿
- 部分补偿
- 补偿装置
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# 前馈补偿

**一句话定义**：在控制系统中，根据输入信号或其导数直接产生控制作用，以抵消预期误差的方法。

**关键公式**：

$$
G_r(s) = \frac{1}{G(s)}
$$

$$
G_r(s) = \tau_1 s
$$

$$
G_r(s) = \tau_1 s + \tau_2 s^2
$$

## 详情

### 完整解释

在控制系统中，根据输入信号或其导数直接产生控制作用，以抵消预期误差的方法。

### 典型示例

- 选择Gr(s)=1/G(s)可实现误差全补偿；选择Gr(s)=τ1s可使系统等效为II型系统。

### 关键词

误差全补偿、部分补偿、补偿装置
