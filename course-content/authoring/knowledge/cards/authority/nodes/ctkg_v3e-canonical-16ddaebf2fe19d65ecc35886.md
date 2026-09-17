---
node_id: ctkg_v3e-canonical-16ddaebf2fe19d65ecc35886
authority_entity_id: "ctkg:v3e-canonical-16ddaebf2fe19d65ecc35886"
name: "自然响应"
name_en: "Natural Response"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b33d8778a7385f2eb3127b9e8a41240dcc5341c8166c391c8b6532c1ab19e907.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b33d8778a7385f2eb3127b9e8a41240dcc5341c8166c391c8b6532c1ab19e907.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-10a/previous/ctkg_v3e-canonical-16ddaebf2fe19d65ecc35886.md"
asset_refs: []
---

## 首页

# 自然响应 | Natural Response

**一句话定义**：自然响应体现系统齐次方程的动态模态，零输入实验可将初始状态引起的响应单独识别出来。

**核心直觉**：先说清采用哪一种响应分解，再解释指数项系数；总响应中的暂态项不一定就是零输入响应。

**关键公式**：本例齐次方程 $\dot y+y=0$ 的模态为 $e^{-t}$。

**学习目标**：区分齐次模态、零输入响应和总暂态，并用叠加检查初始条件。

---

## 详情

### 完整解释

系统即使没有外部输入，也可能因初始储能而继续运动。对线性定常系统，这种零输入运动由齐次状态方程决定，其指数或振荡形式来自系统特征根。自然模态描述这些固有的时间形式，但具体系数还需要初始状态和所采用的分解方式。

常用的“零输入响应加零状态响应”分解具有明确含义：前者保留实际初态并将输入置零，后者保留实际输入并将初态置零。另一种解微分方程的方法是先找一个特解，再加齐次解满足初态；此时那个齐次项的系数可能与零输入响应不同。两种方法都能求得总解，但相应名词与系数不能混用。

### 教学计算/推理例

取归一化模型
$$
\dot y+y=2u,\qquad y(0)=3.
$$
若输入为零，得到
$$
y_{\mathrm{zi}}(t)=3e^{-t}.
$$
这直接显示初始状态沿系统自然模态衰减。若输入改为单位阶跃，零状态响应为 $y_{\mathrm{zs}}=2(1-e^{-t})$，因此实际总响应为
$$
y=y_{\mathrm{zi}}+y_{\mathrm{zs}}
=3e^{-t}+2(1-e^{-t})=2+e^{-t}.
$$
在 $t=0$，总输出仍为 3；在长时间后趋于 2，分别满足初态和稳态方程。

如果从“常数特解 2 加齐次解 $Ce^{-t}$”出发，为满足 $y(0)=3$，会得到 $C=1$。所以总解中的暂态项是 $e^{-t}$，而独立的零输入响应是 $3e^{-t}$。它们含有同一自然模态，却不是同一个响应分量，因为零状态响应中也含有一个 $-2e^{-t}$ 项。

### 适用条件与边界

本例是线性定常一阶系统，叠加成立，且时间与变量已归一化。对于非线性系统，一般不能把两个单独实验的响应直接相加。对于高阶系统，初态通常包含多个状态，仅知道一个输出初值不一定足够确定自然运动。稳定模态会衰减，不稳定模态可能增长，自然响应并不天然意味着“最终消失”。

### 常见误区

1. **误区**：总解里所有指数暂态就是零输入响应。**纠正**：本例总暂态系数为 1，零输入系数为 3。
2. **误区**：有外部输入时就不需要检查初始状态。**纠正**：实际总解仍必须满足原初态。

### 自检

1. 本例哪个表达式是独立的零输入响应？
2. 为什么选常数特解后，齐次项系数变成 1？

**核对要点**：零输入响应为 $3e^{-t}$；特解在初始时刻已贡献 2，只需再用 $e^{-t}$ 满足初值 3。

### 关联节点

- **快极点和慢极点**（无向，关系：相关）
- **系统固有自由响应**（无向，关系：相关）
