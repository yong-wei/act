---
node_id: PID控制器_10_cfaedf40
name: PID控制器
category: 程序性
bloom_level: 应用
chapter: 10
tags:
- 控制器
- 参数整定
- 优化
- 比例
- 积分
- 微分
- 控制器设计
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# PID控制器

**一句话定义**：比例-积分-微分控制器，通过调整参数Kp、Ki、Kd来改善系统动态和稳态性能。

**关键公式**：

$$
$G_c(s) = K_p + \frac{K_i}{s} + K_d s$
$$

$$
Gc=tf([K3,K1,K2],[0,1,0])
$$

## 详情

### 完整解释

比例-积分-微分控制器，通过调整参数Kp、Ki、Kd来改善系统动态和稳态性能。

### 典型示例

- 例10-16和例10-17中，采用ITAE指标设计最优PID控制器参数。
- 图10-13系统中的控制器Gc(s)即为PID控制器，用于实现ITAE最优设计。

### 关键词

控制器、参数整定、优化、比例、积分、微分、控制器设计
