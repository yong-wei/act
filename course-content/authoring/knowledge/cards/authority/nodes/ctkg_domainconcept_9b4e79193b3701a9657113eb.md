---
node_id: ctkg_domainconcept_9b4e79193b3701a9657113eb
authority_entity_id: "ctkg:domainconcept:9b4e79193b3701a9657113eb"
name: "未建模动态"
name_en: "Unmodeled Dynamics"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-9ca1d627c0cd9602e70517bf53a5734c7817466ab398ab510e67a278434fc07b.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-9ca1d627c0cd9602e70517bf53a5734c7817466ab398ab510e67a278434fc07b.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/传统控制结构局限_4_47008.md"
asset_refs: []
---

## 首页

# 未建模动态 | Unmodeled Dynamics

**一句话定义**：真实过程存在、但没有写入名义传递函数 $G(s)$ 的动态。

**核心直觉**：名义模型之外的极点和延迟在高频可能变成主要相位损失，不能用“模型已拟合”抹掉。

**关键公式**（将遗漏动态表示为串联环节时）：
$$
G_{actual}(s)=G_{model}(s)G_{um}(s)
$$

**学习目标**：通过频段验证和裕度检查识别模型遗漏的动态，限制设计带宽。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

未建模动态可以是执行器柔性、传感器滤波、结构模态或高频延迟。若控制器把交越频率推到这些动态附近，名义相位裕度会高估真实余量。建模工作应写出有效频段；在有效频段外，仿真结果只能作为假设下的结果。

### 教学计算/推理例

名义模型为 $G_m(s)=1/(s+1)$，真实对象多一个 $0.05\,\mathrm s$ 极点：$G_{um}(s)=1/(0.05s+1)$。在 $\omega=20\,\mathrm{rad/s}$，遗漏环节幅值为 $1/\sqrt2\approx0.7071$，相位为 $-45^\circ$，已足以改变裕度判断。

### 适用条件与边界

乘性或串联遗漏环节只是本例采用的一种表示，不是所有模型误差的通式。其他遗漏可以表现为加性动态通道、外部扰动或参数偏差，应依据实际作用位置选择表示。需明确名义模型、验证频段和未建模动态的可能范围。不能由单个低频实验点证明高频不存在遗漏。

### 自检

1. 在 $\omega=0$，上述遗漏极点的幅值是多少？
2. 只提高控制器增益是否能消除未建模动态？

**核对要点**：为 $1$；不能，它可能把交越频率推入遗漏动态所在频段。

### 关联节点

- **频率响应匹配法**（出边，关系：相关）
