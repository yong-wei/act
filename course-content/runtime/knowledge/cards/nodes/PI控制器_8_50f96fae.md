---
node_id: PI控制器_8_50f96fae
name: PI控制器
category: 程序性
bloom_level: 应用
chapter: 8
tags:
- 比例积分
- 稳态误差
- 控制器
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# PI控制器

**一句话定义**：一种结合比例和积分作用的控制器，用于消除稳态误差并改善系统动态性能。

**关键公式**：

$$
u(t) = K_p e(t) + K_i \int e(t) dt
$$

$$
G_c(s) = K_p + \frac{K_i}{s}
$$

## 详情

### 完整解释

一种结合比例和积分作用的控制器，用于消除稳态误差并改善系统动态性能。

### 典型示例

- 用于积分器抗饱和漂移控制方案中的控制器结构

### 关键词

比例积分、稳态误差、控制器
