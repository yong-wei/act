---
node_id: ctkg_m3-v1l_canonical-object_9536bb480a03e3193e6e88d2
authority_entity_id: "ctkg:m3-v1l:canonical-object:9536bb480a03e3193e6e88d2"
name: "时延"
name_en: "Delay"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-be8e5348dc90dfd723696f5f37d80198c49146976cab10f0fc8862c3293a24b3.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-be8e5348dc90dfd723696f5f37d80198c49146976cab10f0fc8862c3293a24b3.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/延迟环节_5_a2771a34.md"
asset_refs: []
---

## 首页

# 时延 | Delay

**一句话定义**：系统中一个事件到其结果在另一位置出现之间的时间间隔。

**核心直觉**：延迟参数是时间尺度；映射到频域后变成随频率线性增加的相位损失。

**关键公式**：
$$
T_d=t_{out}-t_{in},\qquad G_d(s)=e^{-sT_d}
$$

**学习目标**：从事件时间戳或模型参数计算延迟，并把过程、采样、计算和执行延迟分开记账。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

“时延”强调可测的时间间隔，“延迟环节”强调实现该关系的输入输出模块，“时间延迟”是更一般的系统现象。把三者混用会掩盖延迟的来源。对控制设计，最关键的是总延迟在带宽附近造成的相位损失。

### 教学计算/推理例

某航向指令在 $t_{in}=2.0\,\mathrm s$ 产生，舵角开始响应于 $t_{out}=2.3\,\mathrm s$，则 $T_d=0.3\,\mathrm s$。在 $\omega=4\,\mathrm{rad/s}$ 时相位损失为 $-\omega T_d=-1.2\,\mathrm{rad}\approx-68.75^\circ$。

### 适用条件与边界

时间戳必须采用同一时钟和同一事件定义。含惯性、滤波或缓冲的响应起始点要先定义，不能把全部上升时间都算成纯延迟。

### 自检

1. 若采样周期为 $0.05\,\mathrm s$，一拍计算延迟至少对应多长时间？
2. 同样的 $0.3\,\mathrm s$ 延迟在更高频率下影响更大吗？

**核对要点**：至少约 $0.05\,\mathrm s$（若按一拍计）；是，相位损失与 $\omega$ 成正比。

### 关联节点

- **纯时延传递函数**（出边，关系：表示）
- **时不变性**（入边，关系：相关）
- **时间延迟**（入边，关系：相关）
- **液位控制系统时延**（入边，关系：相关）
- **时延参数T**（入边，关系：相关）
