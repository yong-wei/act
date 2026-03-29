# Output Contract

## 临时目录布局

为每个题号创建单独的临时目录，推荐如下：

```text
<temp-root>/T3-2/
  task-package.json
  drafts/
    draft-1.json
    draft-2.json
    draft-3.json
  judge/
    draft-selection.json
  selected/
    selected-draft.json
  solvers/
    round-1/
      solver-1.json
      solver-2.json
      solver-3.json
    round-2/
      solver-1.json
      solver-2.json
      solver-3.json
  final/
    final-package.md
    final-package.json
```

不要把这些文件写回项目正式目录，也不要让不同题号共用同一目录。

## `task-package.json`

```json
{
  "question_id": "T3-2",
  "question_type": "C",
  "difficulty": "⭐⭐",
  "title": "根轨迹基本规则应用",
  "ability": "手绘根轨迹草图（8条规则综合应用）",
  "synopsis": "......",
  "why_for_exam": "......",
  "output_requirements": {
    "must_include": [
      "stem",
      "answer",
      "inline_score_points",
      "rubric",
      "self_check"
    ],
    "inline_score_format": [
      "把分值直接嵌入标准答案正文",
      "公式后可用 \\tag{2分}",
      "文本步骤后可用 （2分）"
    ]
  },
  "consensus_rule": {
    "C": "最终数值结果一致，允许等价表达",
    "X": "所有分析项目都回答且方向基本一致",
    "D": "设计路线一致且结果满足题目要求"
  }
}
```

## `draft-*.json`

每个出题智能体输出：

```json
{
  "agent_role": "drafter",
  "draft_id": "draft-1",
  "stem": "完整题面",
  "answer": "标准答案正文，且关键步骤/关键公式后直接带分值标记",
  "inline_score_points": [
    {
      "points": 2,
      "criterion": "写出关键中间结论或完成某一步判断",
      "inline_example": "$$ G(s)=\\\\frac{1}{s+1}.\\\\tag{2分} $$"
    }
  ],
  "rubric": [
    {
      "step": "步骤 1",
      "points": 4,
      "criteria": "得分标准"
    }
  ],
  "pitfalls": [
    "常见错误 1"
  ],
  "self_check": {
    "self_contained": true,
    "gradable": true,
    "matches_question_type": true
  }
}
```

`answer` 的推荐写法：

```markdown
由受力平衡可得

$$
m\ddot{x}(t)+c\dot{x}(t)+kx(t)=f(t).\tag{2分}
$$

代入参数，得到

$$
\ddot{x}(t)+2\dot{x}(t)+4x(t)=f(t).\tag{1分}
$$
```

或：

```markdown
根据结构图化简得到闭环传递函数。（2分）
与标准型比较，读出 $\omega_n=4,\ \zeta=0.5$。（2分）
```

## `draft-selection.json`

裁判智能体输出：

```json
{
  "selected_draft_id": "draft-2",
  "selection_reason": "最符合题号要求且题面自包含",
  "rejected": [
    {
      "draft_id": "draft-1",
      "reason": "评分标准不够可执行"
    },
    {
      "draft_id": "draft-3",
      "reason": "题面分析项与题号梗概不完全一致"
    }
  ],
  "needs_redraft": false
}
```

若 `needs_redraft` 为 `true`，重新跑出题轮次，不进入作答。

## `solver-*.json`

每个作答智能体输出：

```json
{
  "agent_role": "solver",
  "round": 1,
  "solver_id": "solver-1",
  "assumptions": [
    "如果题面未给出某参数，则采用......"
  ],
  "analysis": "完整作答过程",
  "final_answer": "最终答案",
  "validation_notes": [
    "若使用脚本验证，在此记录"
  ]
}
```

注意：solver 输出只用于一致性判定与内部核查，不再要求把其中一份重复转抄为最终交付里的“参考作答”。

## 一致性记录

裁判在 `final-package.json` 中记录：

```json
{
  "consensus": {
    "passed": true,
    "question_type": "C",
    "rounds_used": 1,
    "majority_group": [
      "solver-1",
      "solver-3"
    ],
    "reason": "三份答案最终数值一致"
  }
}
```

如果首轮失败，`rounds_used` 记为 `2`，并说明第二轮占优依据。

## `final-package.md`

最终 Markdown 交付顺序固定为：

1. 题号 / 题型 / 难度
2. 最终题面
3. 标准答案（正文内已嵌入行内得分点）
4. 分步评分标准
5. 裁判结论
6. 一致性记录
7. 是否触发第二轮作答

说明：
- 不再单列“参考作答”章节。
- “行内得分点”的权威呈现位置是标准答案正文内部，而不是单独再抄一份 Markdown 列表。
- 若需要程序化处理，`final-package.json` 仍保留 `inline_score_points` 结构化字段。

## 验收清单

- 题面自包含，不引用项目文件
- 标准答案覆盖题目所有子问
- 标准答案正文内直接标出行内得分点
- 评分标准逐步可判分
- `C/X/D` 一致性标准使用正确
- 首轮不一致时已执行第二轮
- 两轮后仍不稳定的题已判废
- 最终交付未重复输出与标准答案高度重叠的“参考作答”
