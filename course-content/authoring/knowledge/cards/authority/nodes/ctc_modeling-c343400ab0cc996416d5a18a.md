---
node_id: ctc_modeling-c343400ab0cc996416d5a18a
authority_entity_id: "ctc:modeling-c343400ab0cc996416d5a18a"
name: "系统建模简化假设"
name_en: "Simplifying Assumptions in System Modeling"
category: 概念性
knowledge_type: C
bloom_level: 评价
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-ad05a9bddc2fc5ba7ee2415784bc456105dd035112732a638fde47323c699a35.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-ad05a9bddc2fc5ba7ee2415784bc456105dd035112732a638fde47323c699a35.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-01a/previous/ctc_modeling-c343400ab0cc996416d5a18a.md"
asset_refs: []
---

## 首页

# 系统建模简化假设 | Simplifying Assumptions in System Modeling

**一句话定义**：为得到可分析模型而明确暂时忽略或固定的工作条件与物理效应。

**核心直觉**：假设不是“系统本来如此”，而是“在这个问题和范围内先这样近似”；每条假设都带着需要复核的边界。

**关键公式**：
$$
5\dot r+r=0.2\delta,\qquad \dot\psi=r.
$$

**学习目标**：能指出固定航速、小扰动和常系数假设删去了什么，并判断何时必须重新检查模型。

---

## 详情

### 完整解释

动态系统往往包含速度变化、非线性、参数漂移和未建模快过程。简化假设把研究问题限定在一个可表达、可求解的范围内，但不会自动保证结论适用于范围之外。固定教学模型为
$$
5\dot r+r=0.2\delta,\qquad \dot\psi=r,
$$
其中 $t$ 用秒，舵角 $\delta$ 用度，角速度 $r$ 用度/秒，航向 $\psi$ 用度。这个模型可以对应三类典型假设。

第一，固定航速意味着只在一个给定速度附近讨论舵角对角速度的影响；被速度改变带来的水动力系数变化被暂时省略。若船速显著改变，原来的 $5$ 秒时间常数或 $0.2\ \mathrm{s^{-1}}$ 增益未必仍然成立。第二，小扰动意味着只在工作点附近把非线性关系近似为线性关系；大舵角、急剧机动或强烈侧滑可能让高阶项和饱和效应不能忽略。第三，常系数意味着在所研究的时间窗内，惯性、阻尼和舵效被当作不随时间改变；装载、吃水、流况或工作点变化会破坏这个近似。

在十度阶跃舵和零初态下，该模型给出 $r(5)=1.26424$ 度/秒、稳态角速度 $2$ 度/秒。这些数值只说明固定假设下的结果。尤其不能从“十度”这个输入幅值本身推断它对所有船舶都属于小扰动；小扰动是相对于具体工作点和对象尺度的判断。使用模型前要列出假设，使用模型后要看数据、残差或响应是否提示假设已失效。

### 教学计算/推理例

先保持三条假设不变，计算十度阶跃舵的角速度：
$$
r(t)=2(1-e^{-t/5})\ \mathrm{deg/s},\qquad r(5)=1.26424\ \mathrm{deg/s}.
$$
如果研究条件改为明显不同的航速，问题不是把 $r(5)$ 的数值继续照搬，而是先重新评估系数是否随速度改变；如果舵角大到出现饱和，也不能继续把线性方程当作全程模型。假设的作用正是指出这些复核入口。

### 适用条件与边界

本卡的线性模型只覆盖已声明的固定航速、工作点附近、小扰动、常系数范围，参数为教学示例，不代表实船。假设不应隐藏在公式里；改变速度、舵角范围、装载状态、流况、时间窗或输出定义时，应重新识别或验证模型。持续定舵下角速度趋于常值而航向继续变化，这是方程结构的结果，也应纳入边界判断。

### 常见误区

1. **误区**：写出“线性模型”就说明系统在所有舵角下都是线性的。**纠正**：线性化只对指定工作点和扰动范围负责，超出范围要检查非线性与饱和。
2. **误区**：十度舵角天然就是小扰动。**纠正**：是否小取决于对象、工作点和尺度，不能只由角度数字决定。

### 自检

1. 固定航速假设主要删去了哪类影响？改变航速后应先检查什么？
2. 为什么十度阶跃舵可以作为本例输入，却不能作为所有船舶的小扰动证明？

**核对要点**：固定航速暂时忽略速度变化引起的参数变化；改变航速要重新检查 $T=5$ 秒和 $K=0.2\ \mathrm{s^{-1}}$ 等系数。小扰动是相对于具体对象和工作点的条件判断。

### 关联节点

- **控制系统计算机仿真法**（无向，关系：相关）
- **仿真保真度级别**（无向，关系：相关）
- **未建模动态过程**（无向，关系：相关）
- **动态系统建模规范步骤**（无向，关系：相关）
