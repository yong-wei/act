---
node_id: 级数求和法_7_938aebad
name: 级数求和法
category: 程序性
bloom_level: 应用
chapter: 7
tags:
- 无穷级数
- 闭合形式
- 等比级数
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# 级数求和法

**一句话定义**：直接根据z变换的定义，将离散时间函数的z变换写成无穷级数形式，并求和得到闭合形式的一种方法。

**关键公式**：

$$
X(z) = \sum_{n=0}^{\infty} x(nT) z^{-n}
$$

## 详情

### 完整解释

直接根据z变换的定义，将离散时间函数的z变换写成无穷级数形式，并求和得到闭合形式的一种方法。

### 典型示例

- 求单位阶跃函数u(t)的z变换：X(z) = \sum_{n=0}^{\infty} 1 \cdot z^{-n} = 1/(1-z^{-1})，|z|>1。

### 关键词

无穷级数、闭合形式、等比级数
