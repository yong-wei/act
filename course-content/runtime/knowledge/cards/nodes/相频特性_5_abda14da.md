---
node_id: 相频特性_5_abda14da
name: 相频特性
name_en: Phase-Frequency Characteristic
lesson_units:
  - 2-3
category: 概念性
knowledge_type: C
chapter: 5
tags:
  - 层1精化
  - 频域分析
  - 2-3
card_version: 1
source_docs:
  - authoring/lessons/2-3/design/handout.md
asset_refs: []
---

## 首页

# 相频特性 | Phase-Frequency Characteristic

**一句话定义**：输出相对输入的相位变化 $\angle G(j\omega)$ 随频率变化的规律。

**核心直觉**：它回答的是“系统会不会慢半拍，以及慢到什么程度”。

**关键公式**：
$$
\varphi(\omega)=\angle G(j\omega)
$$

**关联**：上位 → 频率特性 · 并列 → 幅频特性

---

## 详情

### 完整解释

相频特性把“时间上的拖后”翻译成了“频率上的相位变化”。在 `2-3` 里，这一点必须和幅频特性并排理解，因为系统不只会削弱某些节奏，也会把它们向后拖。

一阶惯性环节就是典型例子。频率越高，相位越接近 $-90^\circ$，说明高频成分不仅更弱，还更容易出现明显滞后。

### 常见误区

1. **误区**：相位只是画图时顺便带上的附属信息。  
   **纠正**：相位变化直接对应输出在时间轴上的超前或滞后。

2. **误区**：幅值没怎么变，就说明动态影响也不大。  
   **纠正**：即使幅值接近 1，相位滞后仍然可能非常关键。
