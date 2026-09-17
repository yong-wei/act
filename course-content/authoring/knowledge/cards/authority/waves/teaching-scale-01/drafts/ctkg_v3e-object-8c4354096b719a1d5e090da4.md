---
node_id: ctkg_v3e-object-8c4354096b719a1d5e090da4
authority_entity_id: "ctkg:v3e-object-8c4354096b719a1d5e090da4"
name: "拉普拉斯变换"
name_en: "Laplace Transform"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: draft
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8656595b157ea817cf4897082d16600b7ae116697305c8e85d6ac1041cb2ff19.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8656595b157ea817cf4897082d16600b7ae116697305c8e85d6ac1041cb2ff19.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-8c4354096b719a1d5e090da4.md"
asset_refs: []
---

## 首页

# 拉普拉斯变换 | Laplace Transform

**一句话定义**：把时间函数映射为复频域函数，便于把微分方程转为代数关系。

**核心直觉**：微分在 s 域变成乘法，卷积变成乘积，动态模态因此可按极点阅读。

**关键公式**：
$$
F(s)=∫₀∞ f(t)e^(−st)dt
$$

**学习目标**：计算基本信号的拉普拉斯变换，并正确使用微分性质和零初始条件。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

拉普拉斯变换把时间变化编码到复变量 s 中。控制分析常使用因果、单边形式；是否包含初始条件取决于所用变换约定。变换后的表达式仍需关注收敛域，不能只看分式外形。

### 教学计算/推理例

L{e^(−2t)}=1/(s+2)，L{1(t)}=1/s。对微分方程 ẏ+2y=u，零初始条件下有 (s+2)Y=U，因此传递函数为 1/(s+2)。

### 适用条件与边界

要求积分收敛、信号和初值约定清楚。非零初值、冲激和双边变换应加入相应边界项。

### 自检

1. L{1(t)} 是什么？
2. 零初始条件下 ẏ+2y=u 的 Y/U 是什么？

**核对要点**：为 1/s；为 1/(s+2)。

### 关联节点

- **单边拉普拉斯变换**（出边，关系：相关）
- **一阶微分方程拉氏解法**（出边，关系：相关）
- **ℒ_ 拉普拉斯变换**（出边，关系：相关）
- **使用拉普拉斯变换确定y（t）（五步法）**（入边，关系：相关）
- **双边拉普拉斯变换**（入边，关系：属于）
