---
node_id: ctkg_domainconcept_72d64287614ba07da65b3adf
authority_entity_id: "ctkg:domainconcept:72d64287614ba07da65b3adf"
name: "参数变化"
name_en: "Parameter Variation"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-a82ddb6192b89b52ac25a35082a9d9bb4c7f32e706a64da5a0afbb43aad6a26a.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-a82ddb6192b89b52ac25a35082a9d9bb4c7f32e706a64da5a0afbb43aad6a26a.json"
asset_refs: []
---

## 首页

# 参数变化 | Parameter Variation

**一句话定义**：参数变化使对象或控制器的模型系数改变，分析时要明确哪个物理量变化、哪些量保持固定。

改变一种参数记法中的一个量，可能同时改变另一种记法中的多个系数。

---

## 详情

### 完整解释

环境、工况或标定变化可能影响模型参数，但进入方程的方式并不相同。有的参数改变增益，有的移动极点，也可能同时改变多个系数。只有先写清参数化方式，才能解释相应灵敏度或有限变化结果。

固定参数模型对输入可以是线性的，参数改变后的模型族却不一定对参数呈线性关系。不能因为对象被称为线性系统，就将任意参数变化按固定比例直接外推。

比较不同候选时，还应保持控制器、输入、初态和评价指标一致。如果控制器随对象重新整定，结果已经包含两种变化，不能仅归因于对象参数。

### 教学计算/推理例

取对象 $P(s)=p/(s+a)$，控制器为2，负单位反馈。名义 $p=a=1$时，闭环为 $2/(s+3)$，直流增益2/3。

保持 $a=1$，把 $p$增加到1.01，闭环变为 $2.02/(s+3.02)$。保持 $p=1$，把 $a$增加到1.1，闭环则变为 $2/(s+3.1)$，直流增益约0.645161。虽然都是“参数增加”，对输出的作用方向和幅度并不相同。

另一种常见写法是 $P(s)=g/(\tau s+1)$，对应 $p=g/\tau,a=1/\tau$。若固定直流增益 $g$并改变时间常数 $\tau$，那么 $p$和 $a$会一起变化；不能只采用“固定 $p$改变 $a$”的结果来代表这个操作。

例如固定 $g=1$，将 $\tau$从1改为1.1，对象直流增益仍为1，反馈闭环直流增益仍为2/3，但动态时间尺度改变。这与前一个仅增加 $a$的例子不同，参数名称相近并不等于同一种模型变化。

### 适用条件与边界

参数允许范围也很重要。若变化使极点进入不稳定区域、使某个系数为零或改变模型阶次，应重新判断相应分析是否适用。当前数值例保持稳定，主要用于区分参数化和评价口径。

多个参数可能相关，不能总是假定独立变化。物理约束可能要求某些比值保持不变，或者某个参数改变会带动其他量。进行灵敏度分析时，应将这些关系明确写出，避免算出并不存在的变化方向。

实际模型还可能有结构误差，例如被忽略的动态无法仅通过原有参数调整表示。精确计算一个不完整模型的参数效应，不等于已经覆盖全部实际变化。应根据任务选择合适模型及验证范围。

### 常见误区

1. 误区：所有参数增加都产生同方向的响应变化。纠正：增益和极点参数的作用不同，需从方程计算。
2. 误区：改变时间常数就等于在任意标准化形式中只改一个分母系数。纠正：归一化可能同时改变分子与分母参数。

### 自检

1. 固定 $g$改变 $\tau$时，$p$和 $a$怎样变化？
2. 为什么不能把重新整定后的结果全部归因于对象参数变化？

**核对要点**：二者分别为 $g/\tau$和 $1/\tau$，会共同改变。重新整定还改变了控制器，比较已不再是单一对象参数摄动。

### 关联节点

- **灵敏度**（无向，关系：相关）
- **系统灵敏度**（无向，关系：相关）
- **对数灵敏度函数**（无向，关系：相关）
