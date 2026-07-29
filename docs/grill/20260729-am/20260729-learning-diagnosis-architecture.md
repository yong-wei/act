# 助教场景 · 学情精准诊断 —— 架构决策与实施要点

> 基于 use-grill-me 访谈（20260729-am）产出。访谈域词汇详见 docs/grill/20260729-am/CONTEXT.md

## 背景

在助教场景下，围绕教师核心工作流程中的学情诊断环节，通过分析学生作业、测验与学习行为数据，智能识别知识薄弱点，生成学情诊断报告，为教师提供可操作的教学改进依据。

已有基础：ole-based-learning-diagnosis spec 定义了角色化诊断视图。本决策补充生成机制和架构边界。

## 关键决策

### D1: 诊断单位

以规范化知识节点（KnowledgeProgress）为基本诊断单位，六维能力向量作为跨知识节点的聚合视角。

- 教学干预最小粒度是知识点
- KnowledgeProgress（progress 0-100, status）已有逐节点数据
- 教师自定义维度与规范化知识基座约束冲突，排除

### D2: 触发机制

事件驱动——教师在助教界面点击"生成诊断"时触发，无定时批量 pipeline。

- 无后台 pipeline → 需要风险标记作为前置感知指标

### D3: 风险标记

保留轻量后台风险扫描（passive pipeline），仅用于产生 StudentRiskFlag（participation, stagnation, ai_misuse, constraint, cross_domain）。

- 确定性规则引擎（非 AI）
- 只写 StudentRiskFlag 表，不做能力向量或诊断报告
- 风险标记作为教师仪表盘指标，诱导教师点击"生成诊断"

### D4: 报告层次

- 班级级：薄弱知识点分布、能力趋势、风险学生列表
- 学生级：个体知识点薄弱点、错题归因、学习行为异常
- 知识点级：作为学生级报告的支撑细节嵌入，不独立输出

### D5: 生成架构

诊断报告作为 Konling TA 的一个特化 mode 生成，复用 agent session 和 tool runtime。

- 继承 Konling 的权限、引用源治理和 citation guard
- 结构化报告输出由模型生成后持久化

### D6: 诊断工具集

三个获取性工具（分析归因由模型在上下文中完成）：
- get_student_risk_flags — 获取风险标记
- get_class_competency_summary — 获取班级级能力聚合
- get_student_knowledge_progress — 获取逐知识点掌握度

### D7: 报告持久化

诊断报告独立存储为结构化 JSON。Konling mode 负责"生成"，写入数据库。后续查看从数据库读取，不经过 AI。

- 支持跨时间点对比
- 避免模型温度参数导致的不一致

### D8: 诊断到行动的闭环

诊断报告不直接触发教学动作，提供指向性链接到备课工作台的对应知识点位置。

- 诊断回答"哪里有问题"，备课回答"怎么调整"
- 教师在教学备课上下文中自行决定调整方式

## 与现有 Spec 的关系

| 现有 Spec | 关系 |
|-----------|------|
| ole-based-learning-diagnosis | 定义了诊断视图（角色、证据、隐私），本决策补充生成机制和架构边界，不重复定义视图内容 |
| estore-cumulative-learning-portraits | 定义了累积画像和风险标记机制，D3 的风险扫描需对齐其确定性规则 |
| intelligent-teaching-assistant-demo-package | 诊断作为 Konling TA mode 需注册到该包 |

## 实施要点

1. **风险标记规则引擎**：实现 passive pipeline，对齐 estore-cumulative-learning-portraits 中的 stagnation/cross_domain 确定性计算
2. **Konling 诊断 mode**：注册新 mode，集成三个诊断工具
3. **诊断报告持久化模型**：新建或扩展存储
4. **诊断 → 备课链接**：薄弱知识点跳转备课工作台的对应位置
5. **前端诊断入口**：教师仪表盘/助教界面"生成诊断"按钮 + 报告查看
