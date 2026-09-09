---
node_id: ctkg_v3e-object-8c4354096b719a1d5e090da4
authority_entity_id: "ctkg:v3e-object-8c4354096b719a1d5e090da4"
name: "拉普拉斯变换"
name_en: "Laplace Transform"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "2-1"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/lessons/2-1/design/2-1-handout.md
  - course-content/authoring/knowledge/cards/nodes/拉普拉斯变换_2_c635236f.md
asset_refs: []
---

## 首页

# 拉普拉斯变换 | Laplace Transform

**一句话定义**：拉普拉斯变换把时域函数映射到复频域，使线性微分关系转化为代数关系。

**核心直觉**：初始条件随变换进入代数方程，零初值是传递函数定义的一部分。

---

## 详情

### 完整解释

对常见的因果函数，单边拉普拉斯变换写为

$$
F(s)=\mathcal L\{f(t)\}=\int_0^\infty f(t)e^{-st}\,dt,\qquad s=\sigma+j\omega.
$$

积分是否收敛取决于 $s$ 所在的区域。在线性系统分析中，变换的线性性质使输入和响应可以分解；微分性质则把时间导数转换为 $s$ 的乘法，同时保留初始值项：

$$
\mathcal L\{\dot f(t)\}=sF(s)-f(0).
$$

### 一阶对象的变换

若对象满足 $2\dot y+y=u$，则

$$
(2s+1)Y(s)=U(s)+2y(0).
$$

零初始条件下得到 $G(s)=Y(s)/U(s)=1/(2s+1)$。初值非零时，$2y(0)/(2s+1)$ 仍是响应的一部分，不能在总响应中略去。

### 基本变换对

对于 $f(t)=e^{-2t}$，有 $F(s)=1/(s+2)$，收敛域为 $\operatorname{Re}s>-2$。这个简单变换对直接连接了时域衰减项与复频域极点。

### 关联节点

微分方程 · 初始条件 · 传递函数 · 极点
