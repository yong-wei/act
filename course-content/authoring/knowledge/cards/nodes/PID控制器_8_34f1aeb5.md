---
node_id: PID控制器_8_34f1aeb5
name: PID控制器
category: 程序性
bloom_level: 应用
chapter: 8
tags:
- 反馈控制
- 比例积分微分
- 控制器设计
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# PID控制器

**一句话定义**：由比例、积分、微分环节组合而成的经典控制器，用于改善系统动态和稳态性能。

**关键公式**：

$$
D_c(s) = K_p + \frac{K_I}{s} + K_D s
$$

$$
D_c(s) = K_p \frac{s+z}{s}
$$

## 详情

### 完整解释

由比例、积分、微分环节组合而成的经典控制器，用于改善系统动态和稳态性能。

### 典型示例

- 汽车引擎油-气比控制中，采用比例加积分（PI）控制律来保证稳态精度和动态响应。

### 关键词

反馈控制、比例积分微分、控制器设计
