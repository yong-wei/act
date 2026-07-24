---
node_id: 死区与滞环继电非线性_8_ecef008c
name: 死区与滞环继电非线性
category: 概念性
bloom_level: 应用
chapter: 8
tags:
- 继电特性
- 死区
- 滞环
- 描述函数
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# 死区与滞环继电非线性

**一句话定义**：一种结合了死区（输入小范围无输出）和滞环（输出切换有延迟）特性的继电器型非线性环节。

**关键公式**：

$$
N(A) = \frac{4M}{\pi A} \sqrt{1 - (\frac{h}{A})^2} - j\frac{4Mh}{\pi A^2}, \, A \ge h
$$

## 详情

### 完整解释

一种结合了死区（输入小范围无输出）和滞环（输出切换有延迟）特性的继电器型非线性环节。

### 典型示例

- 图 8-38 展示了该特性的正弦响应。
- 通过设置参数 h=0 或 m=-h，可分别得到死区继电特性或滞环继电特性。

### 关键词

继电特性、死区、滞环、描述函数
