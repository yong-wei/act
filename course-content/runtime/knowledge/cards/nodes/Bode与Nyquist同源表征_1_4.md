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
card_version: 1
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

扫过同一组频率点时，Bode 图记录每个点的幅值和相位，Nyquist 图记录同一个复数点的实部和虚部。因此，两种图能够逐频率互相翻译。这个对应关系成立的前提是两张图使用同一个传递函数、同一频率方向和同一符号约定。

### 常见误区

1. **误区**：Nyquist 图是与 Bode 图无关的新对象。
   **纠正**：它们只是同一频率响应的两种组织方式。
2. **误区**：任何两张 Bode 和 Nyquist 图都能相互对应。
   **纠正**：只有传递对象与频率取值一致时才能逐点对应。
