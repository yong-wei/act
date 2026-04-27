# Output Contract

## 临时目录布局

为每个题号创建单独的临时目录，推荐如下：

```text
<temp-root>/T3-2/
  task-package.json
  assets/
    figure-manifest.json
    source/
      optional-source-image.png
    generated/
      fig-1-root-locus.png
      fig-1-root-locus.source.py
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

`assets/` 只服务当前题号：
- `assets/source/` 存放主代理复制进来的允许复用题源图或重绘依据。
- `assets/generated/` 存放出题智能体生成的题面图、答案图和生成脚本。
- `assets/figure-manifest.json` 汇总所有图片。若 `figure_policy.figure_required = true`，该文件必须存在。

## `task-package.json`

```json
{
  "assignment_title": "自动控制原理 作业3：稳定性与动态特性",
  "question_id": "T3-2",
  "question_type": "C",
  "question_score": 20,
  "assignment_score_policy": {
    "assignment_total": 100,
    "question_breakdown": [20, 20, 20, 40]
  },
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
      "self_check",
      "figures_if_required"
    ],
    "inline_score_format": [
      "把分值直接嵌入标准答案正文",
      "公式后可用 \\tag{2分}",
      "文本步骤后可用 （2分）"
    ]
  },
  "figure_policy": {
    "figure_required": true,
    "trigger_reason": "题面构成要求写明必须直接给出根轨迹图",
    "required_figures": [
      {
        "id": "fig-1",
        "role": "stem",
        "kind": "root_locus",
        "recommended_format": "png",
        "must_appear_in_stem": true,
        "text_only_substitution_allowed": false,
        "generation_hint": "用 python3 + matplotlib/control 或 Octave 生成根轨迹主图，标出稳定边界和典型增益点"
      }
    ],
    "allowed_generation_methods": [
      "svg",
      "tikz",
      "python3_matplotlib",
      "python_control",
      "octave"
    ],
    "source_assets": [
      {
        "source_id": "AC-Q-0076",
        "figure_status": "complete",
        "copied_to": "assets/source/AC-Q-0076-image-01.png",
        "allowed_use": "redraw_reference"
      }
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
  "figures": [
    {
      "id": "fig-1",
      "role": "stem",
      "kind": "root_locus",
      "path": "assets/generated/fig-1-root-locus.png",
      "source_path": "assets/generated/fig-1-root-locus.source.py",
      "alt": "根轨迹主图，标出稳定边界和典型增益点",
      "generated_by": "python3_matplotlib",
      "referenced_in_stem": true
    }
  ],
  "pitfalls": [
    "常见错误 1"
  ],
  "self_check": {
    "self_contained": true,
    "gradable": true,
    "matches_question_type": true,
    "score_consistent": true,
    "figure_files_exist": true,
    "figure_requirements_satisfied": true,
    "figure_sources_reproducible": true
  }
}
```

若 `task-package.json` 中 `figure_policy.figure_required = false`，`figures` 可为空数组。若为 `true`，`figures` 必须覆盖 `required_figures`，且 `stem` 必须使用 Markdown 图片语法引用题面图，例如：

```markdown
![根轨迹主图](assets/generated/fig-1-root-locus.png)
```

不得用“图中可见”“如下图”但不提供文件的写法替代。

## `assets/figure-manifest.json`

当 `figure_required = true` 时，图像清单至少包含：

```json
{
  "figure_required": true,
  "figures": [
    {
      "id": "fig-1",
      "role": "stem",
      "kind": "root_locus",
      "path": "assets/generated/fig-1-root-locus.png",
      "source_path": "assets/generated/fig-1-root-locus.source.py",
      "alt": "根轨迹主图，标出稳定边界和典型增益点",
      "generated_by": "python3_matplotlib",
      "source_asset_ids": ["AC-Q-0076"],
      "referenced_in_stem": true
    }
  ]
}
```

`path` 和 `source_path` 必须是当前题号临时目录内的相对路径。若图片是直接复用题库图片，也必须先复制到 `assets/source/`，再从题面引用临时目录副本。

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
  "score_check": {
    "question_score": 20,
    "score_consistent": true,
    "score_reasonable": true,
    "assignment_structure_compatible": true
  },
  "figure_check": {
    "figure_required": true,
    "all_required_figures_present": true,
    "all_stem_figures_referenced": true,
    "all_figure_paths_in_current_temp_dir": true,
    "text_only_substitution_detected": false,
    "reproducible_sources_present": true
  },
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

若 `figure_required = true`，只要 `figure_check` 中任一核心项不合格，必须把对应草稿列入 `rejected`，不得入选。

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
  "figure_usage": [
    {
      "figure_id": "fig-1",
      "used_for": "读取稳定边界和典型增益点"
    }
  ],
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

1. 作业名称（若适用）
2. 题号 / 题型 / 难度 / 题目分值
3. 最终题面
4. 图片清单（仅当 `figure_required = true`）
5. 标准答案（正文内已嵌入行内得分点）
6. 分步评分标准
7. 裁判结论
8. 一致性记录
9. 是否触发第二轮作答

说明：
- 不再单列“参考作答”章节。
- “行内得分点”的权威呈现位置是标准答案正文内部，而不是单独再抄一份 Markdown 列表。
- 若需要程序化处理，`final-package.json` 仍保留 `inline_score_points` 结构化字段。
- 若 `figure_required = true`，最终题面必须保留 Markdown 图片引用；图片清单必须列出 `id`、`role`、`kind`、`path`、`source_path` 和 `alt`。

## 验收清单

- 题面自包含，不引用项目文件
- 若 `figure_required = true`，题面包含真实图片引用，不用纯文字替代图像
- 图片文件位于当前题号临时目录，路径不指向项目正式目录或其他题号目录
- 结构图/信号流图/方框图优先为 SVG/TikZ；响应图、Bode/Nyquist 图、根轨迹图有脚本或数据可复现
- 标准答案覆盖题目所有子问
- 标准答案正文内直接标出行内得分点
- 评分标准逐步可判分
- `C/X/D` 一致性标准使用正确
- 首轮不一致时已执行第二轮
- 两轮后仍不稳定的题已判废
- 最终交付未重复输出与标准答案高度重叠的“参考作答”
