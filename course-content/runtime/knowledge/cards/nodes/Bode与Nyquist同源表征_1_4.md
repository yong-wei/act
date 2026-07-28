---
node_id: Bode与Nyquist同源表征_1_4
name: Bode与Nyquist的同源表征
name_en: Common Origin of Bode and Nyquist Representations
lesson_units:
  - 1-4
category: 概念性
knowledge_type: X
chapter: 1
tags:
  - 1-4
  - Bode
  - Nyquist
card_version: 2
source_docs:
  - authoring/lessons/1-4/design/1-4-handout.md
asset_refs:
  - 1-4-fig-04-open-loop-nyquist.png
---

## 首页

# Bode 与 Nyquist 的同源表征

**一句话定义**：Bode 图和 Nyquist 图都来自同一个 $G(j\omega)$；前者分开排列幅值与相位，后者把复数值直接画在复平面上。

**关键公式**：
$$
G(j\omega)=|G(j\omega)|e^{j\angle G(j\omega)}
$$

## 详情

### 完整解释

对同一个传递函数，在同一个有符号频率 $\omega$ 上，幅值与相位唯一确定复数 $G(j\omega)$，因此 Bode 与复平面轨迹可以逐频率互译。Bode 图通常只展示正频率；对实系数系统，负频率响应满足 $G(-j\omega)=G^*(j\omega)$。正频率响应支并不等于完整 Nyquist 围线，也不携带开环右半平面极点数，不能单独替代 Nyquist 判据所需的全部信息。

### 常见误区

1. **误区**：Nyquist 图是与 Bode 图无关的新对象。
   **纠正**：它们只是同一频率响应的两种组织方式。
2. **误区**：任何两张 Bode 和 Nyquist 图都能相互对应。
   **纠正**：只有传递对象、有符号频率与符号约定一致时才能逐点对应；完整围线还需额外信息。
