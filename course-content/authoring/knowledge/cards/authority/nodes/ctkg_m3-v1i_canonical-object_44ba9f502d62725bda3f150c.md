---
node_id: ctkg_m3-v1i_canonical-object_44ba9f502d62725bda3f150c
authority_entity_id: "ctkg:m3-v1i:canonical-object:44ba9f502d62725bda3f150c"
name: "相位裕度"
name_en: "Phase Margin"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b3f6f4d7c04d65d1ebbb2fb83f009e6fd15afb28393e2a33122211186b88c532.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b3f6f4d7c04d65d1ebbb2fb83f009e6fd15afb28393e2a33122211186b88c532.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/相位裕度直觉_5_L2c003.md"
asset_refs: []
---

## 首页

# 相位裕度 | Phase Margin

**一句话定义**：在增益穿越频率处，距离额外相位滞后导致临界失稳的相位余量。

**核心直觉**：在 $|L|=1$ 的频率读相位；离 $-180^\circ$ 越远，允许的附加滞后通常越多。

**关键公式**：
$$
\omega_{gc}:|L(j\omega_{gc})|=1,\qquad PM=180^\circ+\angle L(j\omega_{gc})
$$

**学习目标**：找到正确的增益穿越频率后计算相位裕度，并说明多交越和开环不稳定的限制。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

相位裕度是相对稳定性的频域指标，不是“相位为正”这么简单。标准单一交越、开环稳定情形下，$\angle L=-140^\circ$ 给出约 $40^\circ$ 裕度；但多次穿越、纯延迟、右半平面极点或非最小相位结构需要结合 Nyquist 或完整判据。

### 教学计算/推理例

对 $L(s)=2/[s(s+1)]$，解 $|L(j\omega)|=1$ 得 $\omega_{gc}\approx1.2496\,\mathrm{rad/s}$。相位为 $-90^\circ-\arctan(1.2496)\approx-141.34^\circ$，所以 $PM\approx38.66^\circ$。

### 适用条件与边界

需要明确 $L$ 是完整环路传递函数、角度采用连续展开，并确认所用交越是相关的增益穿越点。不能由一个稳定算例推广到所有反馈系统。

### 自检

1. 若交越频率处相位为 $-150^\circ$，PM 是多少？
2. 加入滞后补偿后，原来的 PM 能否直接当作新 PM？

**核对要点**：为 $30^\circ$；不能，补偿改变幅相曲线后必须在新的交越频率重新读取。

### 关联节点

- **相位裕度定义**（入边，关系：相关）
- **增益裕度定义**（出边，关系：相关）
- **相位裕度定义（临界稳定）**（出边，关系：相关）
- **相角裕度**（入边，关系：相关）
- **从奈奎斯特图确定相位裕度**（入边，关系：相关）
