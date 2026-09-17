---
node_id: ctc_modeling-afa39b57a646673e84b55f09
authority_entity_id: "ctc:modeling-afa39b57a646673e84b55f09"
name: "元件级联负载效应"
name_en: "Loading in Cascaded Components"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-d801ee25f46ca31aeed54575c9bbe8bf1c9c4cd724f639c21afba6c505f8e9c9.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-d801ee25f46ca31aeed54575c9bbe8bf1c9c4cd724f639c21afba6c505f8e9c9.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-02a/previous/ctc_modeling-afa39b57a646673e84b55f09.md"
asset_refs: []
---

## 首页

# 元件级联负载效应 | Loading in Cascaded Components

**一句话定义**：后级接入改变前级端口电流或其他端口变量，使实际级联关系偏离各元件空载模型乘积的现象称为负载效应。

**核心直觉**：后级不仅接收前级输出，也可能反过来改变前级的工作状态。

**关键公式**：两个无缓冲 RC 级联可得到 $1/(s^2+3s+1)$，而不是孤立模型乘积 $1/(s+1)^2$。

**学习目标**：识别传递函数相乘的端口条件，并从节点方程计算实际加载后的系统。

---

## 详情

### 完整解释

把两个信号方框串联时，通常假定后级读取前级输出而不改变它。但两个实际无源电路直接连接时，后级输入会从前级取电流，前级原先测得的空载输出就可能变化。问题不在于传递函数不能使用，而在于孤立元件模型的端口条件已不成立。

因此，“总传递函数等于各级传递函数的乘积”需要先确定各级在连接条件下的输入输出关系。理想缓冲器可以隔离负载：其输入不取电流，输出能驱动后级。实际缓冲器仍有有限带宽和输出能力，不能在所有频率、所有负载下都视为理想。

### 教学计算/推理例

考虑两级 RC：输入 $u$ 经 $R_1$ 接节点 $v_1$，$C_1$ 从该节点接地；再经 $R_2$ 接节点 $v_2$，$C_2$ 接地。取 $R_1=R_2=1\,\Omega$，$C_1=C_2=1\,\mathrm F$。节点电流守恒给出
$$
\dot v_1=u-2v_1+v_2,\qquad \dot v_2=v_1-v_2.
$$
零初态下消去 $V_1$，得到
$$
\frac{V_2(s)}{U(s)}=\frac1{(s+2)(s+1)-1}=\frac1{s^2+3s+1}.
$$
如果中间加入理想缓冲器，每一级才保持孤立时的 $1/(s+1)$，总传函为 $1/(s+1)^2$。在 $\omega=1\,\mathrm{rad/s}$，无缓冲模型分母为 $3j$，幅值为 $1/3$；理想缓冲模型幅值为 $1/2$。虽然二者直流增益都为 1，动态响应却不同。

同样的现象也出现在静态电位器：总电阻 $1\,\Omega$，电刷位于中点，输出负载也是 $1\,\Omega$。下半段与负载并联得 $1/3\,\Omega$，输出比为 $(1/3)/(1/2+1/3)=0.4$，而空载比为 $0.5$。

### 适用条件与边界

上述电路采用理想电阻电容、理想电压源和零初态。加载改变了节点关系，不能用“两个模块功能一样”来忽略。机械、液压等系统也有类似端口相互作用，但不能直接照搬电路参数；应回到对应的力、流量或能量关系。

### 常见误区

1. **误区**：直流增益相同就表示模型相同。**纠正**：本例在 1 rad/s 已出现不同幅值。
2. **误区**：接上负载只影响后级。**纠正**：它也改变前级节点电流，从而改变前级输出。

### 自检

1. 第一条节点方程中为什么有 $-2v_1+v_2$？
2. 电位器加载后输出比为什么小于空载的 $0.5$？

**核对要点**：第一级同时向自身电容和后级支路供电；负载降低了分压器下臂等效电阻。

### 关联节点

- **结构图绘制规范步骤**（无向，关系：相关）
