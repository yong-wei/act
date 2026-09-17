---
node_id: ctkg_v3e-object-a31f4a2e9bdbef014d44cfb8
authority_entity_id: "ctkg:v3e-object-a31f4a2e9bdbef014d44cfb8"
name: "反馈校正"
name_en: "Local Feedback Compensation"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-04f3765accd66f9c1d182f5b7437ec901f31937b1fc18f134ad42d35f2d08524.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-04f3765accd66f9c1d182f5b7437ec901f31937b1fc18f134ad42d35f2d08524.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-20a/previous/ctkg_v3e-object-a31f4a2e9bdbef014d44cfb8.md"
asset_refs: []
---

## 首页

# 反馈校正 | Local Feedback Compensation

**一句话定义**：反馈校正把校正环节接入局部反馈通路，先改变被包围环节的等效动态，再与外部系统共同分析。

局部回路的等效函数不一定就是整个系统最终的闭环函数。

---

## 详情

### 完整解释

局部反馈可以围绕执行机构或某个子环节构成内环，使外部系统看到一个新的等效对象。这个过程需要明确内环反馈符号、前向环节和校正环节位置，不能只在总框图上写一个“反馈”标签就推断结果。

若内环前向为 $G$、局部负反馈为 $H$，内环等效函数为 $G/(1+GH)$。之后若还存在外环控制器或反馈，应继续使用这个等效对象推导最终关系。直接把内环函数当作全系统参考传递函数，会遗漏外环作用。

局部反馈是否改善性能取决于具体模型。它会改变内环增益和动态，也可能改变外环精度与控制需求。因此，局部稳定、外环稳定和最终输出指标应分别核验，不能互相替代。

### 教学计算/推理例

取局部前向 $G(s)=1/(s+1)$，局部校正 $H(s)=2/(s+2)$，采用负反馈。内环等效对象为

$$G_{eq}(s)=\frac{G}{1+GH}=\frac{s+2}{s^2+3s+4}.$$

如果外部再对 $G_{eq}$施加单位负反馈，则整体参考传递函数为

$$T(s)=\frac{G_{eq}}{1+G_{eq}}=\frac{s+2}{s^2+4s+6}.$$

两个函数分母不同，直流增益也分别为1/2和1/3。只计算第一个，就不能报告整个两层反馈系统的最终参考响应。

这个例子也说明不能仅因局部反馈环节本身稳定，就跳过闭环计算。每个反馈连接都会产生新的特征关系，应该从对应节点方程逐层核对，而不是把环节稳定性简单相加。

### 适用条件与边界

本例为线性、确定参数和所声明的负反馈结构。若局部校正环节包含速度测量、滤波或时延，应把这些动态保留在 $H$中；若符号改变，分母也相应变化。不同资料的局部回路定义可能不同，比较时应先对齐实际方程。

内环等效化简还应留意被隐藏的内部状态和可能的极零约消。一个外部通道看起来稳定，不自动证明全部内部状态都稳定；必要时应检查完整状态模型。这里没有用约消来删除不稳定模态。

若扰动进入内环内部，它到输出的传递关系也不同于参考通道。反馈校正的效果常需同时检查参考跟踪与扰动抑制，不能只用一个函数替代所有入口。当前计算明确是参考关系，未宣称其他通道已经验收。

### 常见误区

1. 误区：求得内环等效函数就完成全部闭环分析。纠正：若还有外环，必须继续闭合并检查最终关系。
2. 误区：校正环节自身稳定就保证连接后的系统稳定。纠正：闭环特征方程由连接共同决定，需要实际计算。

### 自检

1. 本例内环与最终外环的直流增益各是多少？
2. 为什么不能把 $s^2+3s+4$直接当作最终闭环分母？

**核对要点**：分别为1/2与1/3。外环单位反馈进一步改变分母，得到 $s^2+4s+6$，不能漏掉这一层关系。

### 关联节点

- **校正装置**（入边，关系：前置于）
- **校正装置**（出边，关系：属于）
