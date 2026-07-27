---
node_id: 微分控制规律_6_ddd5d58f
name: 微分控制规律
category: 概念性
bloom_level: 理解
chapter: 6
tags:
- 微分作用
- 动态过程
- 系统噪声
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# 微分控制规律

**一句话定义**：控制器的输出与输入信号的变化率（微分）成正比，能预测误差变化趋势。

**关键公式**：

$$
u(t) = K_d \frac{de(t)}{dt}
$$

## 详情

### 完整解释

控制器的输出与输入信号的变化率（微分）成正比，能预测误差变化趋势。

### 典型示例

- 单一的D控制器对噪声敏感，不宜单独使用，常与P或PI结合构成PD或PID。

### 关键词

微分作用、动态过程、系统噪声
