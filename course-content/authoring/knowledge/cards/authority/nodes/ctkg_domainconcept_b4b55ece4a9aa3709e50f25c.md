---
node_id: ctkg_domainconcept_b4b55ece4a9aa3709e50f25c
authority_entity_id: "ctkg:domainconcept:b4b55ece4a9aa3709e50f25c"
name: "时域响应参数灵敏度"
name_en: "Parameter Sensitivity of Time-domain Response"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-ba4f6b6c2d47bbe88a1b7e78521972d3b3488b164af2db8b4036eb34f5c6c212.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-ba4f6b6c2d47bbe88a1b7e78521972d3b3488b164af2db8b4036eb34f5c6c212.json"
asset_refs: []
---

## 首页

# 时域响应参数灵敏度 | Parameter Sensitivity of Time-domain Response

**一句话定义**：时域响应参数灵敏度在固定输入、初态和时刻下，衡量输出对某个参数的小变化。

它可以随时间改变，不自动等于稳态灵敏度或调节时间的灵敏度。

---

## 详情

### 完整解释

动态响应是时间与参数的函数。若关心某一时刻的输出变化，可对参数求偏导；若还需要相对变化，则在输出和参数非零处归一化。比较时必须固定观察时刻、输入波形和初态，不能把不同时间的输出差异直接当作参数效应。

过渡早期与稳态可能具有不同敏感程度。某参数既改变终值也改变时间尺度，其影响会叠加在响应中。因此，使用直流增益灵敏度解释整条曲线，可能遗漏早期作用。

还要区分输出灵敏度和性能指标灵敏度。峰值、上升时间、调节时间等由额外事件或阈值定义，未必能直接用固定时刻的输出导数替代。出现零输出或不可光滑事件时，应重新检查定义。

### 教学计算/推理例

取 $P=p/(s+a)$、控制器增益 $k$，单位负反馈、零初态单位阶跃。响应为

$$y(t,p)=\frac{kp}{a+kp}\left(1-e^{-(a+kp)t}\right).$$

固定 $a,k$，在 $t>0$且相应量非零处，对 $p$求归一化导数得

$$S_p^y(t)=\frac{a}{a+kp}+\frac{kp\,t}{e^{(a+kp)t}-1}.$$

取 $a=p=1,k=2$，在0.1 s时约为0.904993，在1 s时约为0.438125，在5 s时约为0.333336。它随时间趋近稳态值1/3，不能用一个常数替代整个过程。

当 $t\to0^+$时，响应近似 $kp,t$，归一化灵敏度趋于1。但在 $t=0$本身，所有零初态响应都为零，相对形式是未定义的；右极限1不能被直接当作该点的函数值。

### 适用条件与边界

上式仅比较同一单位阶跃、同一零初态下的参数变化。如果改变初始积分状态或输入幅度，观察到的差异就不只来自 $p$。实际分析应先隔离要研究的因素。

当输出穿过零时，相对灵敏度可能不适合解释，应考虑绝对导数或其他明确尺度。不能通过偷偷添加一个小常数把归一化问题隐藏起来，再把结果当作原定义。

调节时间灵敏度还要考虑终值尺度、容差带及最后越界事件。固定时刻输出对参数的导数，只提供部分信息，不足以直接给出调节时间变化。对于复杂响应，应按对应指标的定义单独分析。

### 常见误区

1. 误区：稳态灵敏度1/3适用于全部时刻。纠正：本例早期接近1，时间条件不能省略。
2. 误区：右极限为1就表示 $t=0$的归一化值也是1。纠正：该点输出为零，原比值未定义。

### 自检

1. 本例0.1 s与5 s的灵敏度为什么不同？
2. 为什么不能从这条函数直接读出2%调节时间灵敏度？

**核对要点**：参数同时影响过渡速度和终值，早期与长期贡献不同。调节时间由持续进入容差带的事件定义，需要额外计算。

### 关联节点

- **灵敏度**（无向，关系：相关）
- **系统灵敏度**（无向，关系：相关）
