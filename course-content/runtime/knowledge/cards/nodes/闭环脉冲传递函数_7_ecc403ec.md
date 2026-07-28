---
node_id: 闭环脉冲传递函数_7_ecc403ec
name: 闭环脉冲传递函数
category: 概念性
bloom_level: 理解
chapter: 7
tags:
- 闭环系统
- 脉冲传递函数
- z变换
- 系统性能
- 设计依据
- 闭环
- 稳定性
- 动态响应
card_version: 1
source_docs:
- course-content/authoring/knowledge/base/knowledge_graph.json
---

## 首页

# 闭环脉冲传递函数

**一句话定义**：离散系统中，输出信号的z变换与输入信号的z变换之比，描述了系统的闭环动态特性。

**关键公式**：

$$
\Phi(z)=\frac{C(z)}{R(z)}=\frac{G(z)}{1+G(z)}
$$

$$
$\Phi(z) = \frac{Y(z)}{R(z)}$
$$

$$
\Phi(z) = \frac{D(z)G(z)}{1 + D(z)G(z)}
$$

$$
\Phi_e(z) = \frac{1}{1 + D(z)G(z)}
$$

## 详情

### 完整解释

离散系统中，输出信号的z变换与输入信号的z变换之比，描述了系统的闭环动态特性。

### 典型示例

- 用于通过z反变换求取系统的时间响应序列c(kT)。
- 用于描述闭环离散系统动态性能的传递函数
- 用于最少拍系统设计，确定控制器形式。

### 关键词

闭环系统、脉冲传递函数、z变换、系统性能、设计依据、闭环、稳定性、动态响应
