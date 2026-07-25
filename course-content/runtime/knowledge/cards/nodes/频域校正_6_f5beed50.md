---
node_id: 频域校正_6_f5beed50
name: 频域校正
category: 程序性
bloom_level: 应用
chapter: 6
tags:
- 串联校正
- 相角裕度
- 截止频率
- 稳态误差
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# 频域校正

**一句话定义**：在开环系统对数频率特性基础上，以满足稳态误差、截止频率和相角裕度等要求进行的串联校正方法。

**关键公式**：

$$
\omega_c' = \omega_m
$$

$$
\gamma'' = \phi_m + \gamma(\omega_c')
$$

## 详情

### 完整解释

在开环系统对数频率特性基础上，以满足稳态误差、截止频率和相角裕度等要求进行的串联校正方法。

### 典型示例

- 例6-3采用串联无源超前网络进行频域校正，以满足单位斜坡输入下的稳态误差和相角裕度要求。
- 利用超前网络或PD控制器进行串联校正，以改善闭环系统的动态性能。

### 关键词

串联校正、相角裕度、截止频率、稳态误差
