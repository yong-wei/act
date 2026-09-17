---
node_id: ctkg_v3e-canonical-cd25e47d10ddfec280e82fde
authority_entity_id: "ctkg:v3e-canonical-cd25e47d10ddfec280e82fde"
name: "单位加速度函数"
name_en: "Unit-Acceleration Function"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e949e356b72ec5e96dd2f78a53438c1e68e2eca53386d9849abe9cbae68cea17.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e949e356b72ec5e96dd2f78a53438c1e68e2eca53386d9849abe9cbae68cea17.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-cd25e47d10ddfec280e82fde.md"
asset_refs: []
---

## 首页

# 单位加速度函数 | Unit-Acceleration Function

**一句话定义**：随时间按 t²/2 增长的标准多项式输入。

**核心直觉**：它比斜坡再高一阶，用来检验闭环低频是否有足够积分能力。

**关键公式**：
$$
r(t)=t²/2·1(t),  R(s)=1/s³
$$

**学习目标**：区分单位加速度输入、任意二次输入和物理加速度测量。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

单位加速度函数是控制理论中的测试输入，数值上在 t=2 s 达到 2。它不一定表示物体真实的加速度传感器信号；在稳态误差分析中，关键是它的拉氏低频阶次。

请同时检查结果的正负号、数量级和归一化；若与直觉冲突，应优先回查输入类型、通道位置和初始条件。

### 教学计算/推理例

对 Ka=4 的Ⅱ型单位反馈系统，单位加速度输入的理想稳态误差为 1/Ka=0.25。若输入改成 3t²/2，误差尺度也随幅值乘 3，变为 0.75。

### 适用条件与边界

要求输入从 t=0 开始、按标准归一化定义，且误差终值存在。实际轨迹可能有加速度限幅，不能无限延长理想多项式。

### 自检

1. t=2 s 时单位加速度的目标值是多少？
2. 把输入幅值乘 3，稳态误差是否仍为 0.25？

**核对要点**：为 2；不一定，在线性范围内也会乘 3。

### 关联节点

- **典型输入信号**（入边，关系：包含）
