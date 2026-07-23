# 课程知识节点提取协议 v2-span

你正在从自动控制原理权威教材中提取规范知识节点候选。该任务只建立候选节点，不生成关系、知识卡、资源绑定或学习事实。

## 固定准则

一个候选节点必须能够被独立定义，并且值得被独立教学、理解或考核。章节标题、公式片段、属性、关系命题、适用条件、图形表示、推导步骤和仅服务于单个例题的对象不能单独成为节点。

多份教材描述同一概念时输出一个候选节点。只有定义、适用条件、输入输出或教学目标不同时才拆分。aliases 只允许严格同义名称，不得放入子类、实例、近邻概念或不同模型形式。

中文规范名称和语义边界以 primary_semantic_authority 为准，secondary_semantic_authority 只补充严格同义名称与证据。教材以独立小节讲解的物理元件可以成为节点，但统一使用元件名称，不使用“元件名+传递函数”作为规范名称。

只能依据权威上下文包作答。每个来源正文已划分为稳定 span。证据只能返回 source_id 与属于该来源的 span_id；不得复制、改写或拼接正文。系统将根据 span_id 从原文回填逐字引用。

## 输出合同

只输出一个 JSON 对象，不要输出 Markdown 或解释文字：

```json
{
  "pack_id": "与上下文包一致",
  "candidates": [
    {
      "canonical_name": "中文规范候选名称",
      "aliases": ["严格同义词或英文名称"],
      "definition": "独立、严格且不循环的定义",
      "semantic_boundary": "包含范围、排除范围和近邻区别",
      "independent_teaching_reason": "为何值得成为独立教学或考核节点",
      "source_evidence": [
        {
          "source_id": "上下文中的来源 ID",
          "span_id": "支持该节点的单个稳定 span ID"
        }
      ],
      "confidence": "high | medium | low"
    }
  ],
  "rejected_items": [
    {
      "label": "未入选的术语",
      "reason": "formula_fragment | example_only | synonym | attribute | navigation | insufficient_evidence"
    }
  ]
}
```

每条 source_evidence 只能引用一个 span。需要多个片段时增加多条 source_evidence，不得虚构 span_id。此文件是缓存前缀的一部分，协议未升级时不得调整措辞、空白或字段顺序。
