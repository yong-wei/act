---
node_id: ctkg_v3e-object-60dc281db22fe43eefe4ae57
authority_entity_id: "ctkg:v3e-object-60dc281db22fe43eefe4ae57"
name: "有限字长"
name_en: "Finite Word Length"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-27363ddb54c38a2f850313cb9f020fa817a332c82b99c4cf03e3bea790ec8558.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-27363ddb54c38a2f850313cb9f020fa817a332c82b99c4cf03e3bea790ec8558.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-02a/previous/ctkg_v3e-object-60dc281db22fe43eefe4ae57.md"
asset_refs: []
---

## 首页
# 有限字长 | Finite Word Length

一句话定义：有限字长指数字实现用有限位数表示信号、系数和中间结果，由此产生量化、舍入及溢出等限制。

- 系数量化与信号量化影响的位置不同。
- 溢出限幅和回绕会产生不同结果。
- 理想实数模型稳定不自动保证有限精度实现保持同样行为。

---
## 详情
### 完整解释

数字系统中的位数、定点缩放或浮点格式决定可表示范围与分辨率。每次乘加是否扩展位宽、何时舍入、如何处理溢出，都可能改变最终递推。只写“使用若干位”不足以完整定义实现。

系数量化会改变系统方程；状态或信号量化则在运行中引入值的偏差。两者有时可近似分析为误差源，但并非天然独立白噪声，特别是在反馈递推和小信号状态下，误差可能有结构或累积。

### 教学计算/推理例

理想标量系统 $x[k+1]=0.99x[k]$ 的零输入状态逐步衰减。若系数用步长0.125最近舍入，0.99被量化为1，实际递推变为 $x[k+1]=x[k]$。原来渐近衰减的性质丢失；这不等于必然发散，却已经与原模型的稳定收敛结论不同。

再声明一个有符号4位二进制补码、含2个小数位的定点格式，可表示范围为 $[-2,1.75]$，间隔0.25。计算 $1.5+0.75=2.25$ 超出范围。若采用饱和处理，结果为1.75；若按4位补码回绕，整数编码9回绕为 $-7$，结果为 $-1.75$。同一数学加法因溢出规则不同产生截然不同的结果。

因此验证不能只比较正常小数值的几次运算。靠近稳定边界的系数、最大幅值、中间乘积以及负数边界，都可能暴露重要差异。实现说明应与实际舍入和溢出规则一致。

### 适用条件与边界

本例用定点格式说明问题，浮点也具有有限精度和范围，但其间隔随数值大小变化，不能直接套用固定步长模型。提高总位数若同时改变缩放范围，也不必然按相同比例改善分辨率。

有限字长可导致稳定裕度变化、误差累积或某些系统中的零输入周期行为，但不能从“位数有限”直接推断每个系统都会出现这些现象。需要针对具体结构、系数和算术流程验证。控制器的不同等价实现形式，在有限精度下也未必等价。

对关键实现可用实际算术规则重算状态轨迹，并与高精度参考比较。若只在理想实数环境跑通，不应声称已证明定点部署行为。测试范围应覆盖声明的输入、初态与参数，而不是靠无限精度模型替代硬件规则。

### 常见误区

1. 把所有有限字长影响都简化成固定均匀噪声。
2. 只给位数，不给小数位、舍入位置和溢出处理。
3. 将系数舍入到1后的不衰减误说成一定指数发散。

### 自检

1. 系数0.99被量化为1后，初态1的零输入序列是什么？
2. 本例2.25在饱和与回绕模式下分别得到什么？

**核对要点**：始终为1，不再衰减；分别为1.75和 $-1.75$，必须明确算术模式。

### 关联节点

- **精度**（无向，关系：相关）
- **精度**（出边，关系：适用于）
