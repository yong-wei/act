# Output Contract

## 临时目录根路径（固定）

所有题目的临时目录统一置于：

```
.tmp/homework-problem-authoring/<QUESTION_ID>/
```

例：`.tmp/homework-problem-authoring/T3-2/`

不同题号必须各用独立子目录，不得共用。

## 临时目录布局

```text
.tmp/homework-problem-authoring/T3-2/
  task-package.json          ← 主代理写，各出题/作答智能体只读
  drafts/
    draft-1/
      stem.md                ← draft-1 的题面（含图片相对引用 assets/xxx.png）
      draft-1.json           ← draft-1 的完整 JSON
      assets/
        step-response.png    ← draft-1 生成的图片（只属于 draft-1）
        gen_step.py          ← 对应生成脚本
    draft-2/
      stem.md
      draft-2.json
      assets/
    draft-3/
      stem.md
      draft-3.json
      assets/
  judge/
    draft-selection.json     ← 裁判选题 + 图片核验 + 公式修正记录
  selected/
    selected-draft.json      ← 从 draft-selection.json 衍生的简要记录
    stem.md                  ← 裁判从选中草稿复制，并完成公式修正
    assets/                  ← 从选中草稿的 assets/ 复制
  solvers/
    round-1/
      solver-1.json
      solver-2.json
      solver-3.json
    round-2/                 ← 仅首轮不一致时存在
      solver-1.json
      solver-2.json
      solver-3.json
  final/
    final-package.md         ← 最终 Markdown 产物（含图片引用 ../selected/assets/xxx.png）
    final-package.json       ← 机器可读版本
```

## 图片生成规范（三分类，强制执行）

出题智能体在制作题面时，**必须按图表语义类型选择对应工具**，不得降级（如用 matplotlib 代替 TikZ 画方框图）或升级（如对一般示意图生成实体图片文件）。

### 类型 A — 精确仿真图（Python-control library）

适用：阶跃响应、脉冲响应、根轨迹、Bode 图（幅频/相频）、Nyquist 图、极点零点图、时域/频域响应曲线等。

| 图表类型 | 推荐 API |
|----------|---------|
| 阶跃/脉冲响应曲线 | `control.step_response()` / `control.impulse_response()` |
| Bode 图 | `control.bode_plot()` |
| Nyquist 图 | `control.nyquist_plot()` |
| 根轨迹 | `control.root_locus()` |
| 极零点图 | `control.pzmap()` |

生成规范：
- 用 `control.tf()` 或 `control.ss()` 构建系统，**禁止手工构造数据点**
- 脚本保存为 `drafts/draft-N/assets/gen_<name>.py`，图片与脚本同目录
- 图片文件命名清晰，如 `step-response.png`、`bode-plot.png`、`root-locus.png`
- 图片尺寸建议 `(8, 5)` 英寸，DPI ≥ 150；坐标轴必须有标签和单位；字体大小 ≥ 10pt
- 题面 `stem.md` 中用相对路径引用：`![图说明](assets/xxx.png)`

### 类型 B — 原理性结构图（tikz-control-draw 技能）

适用：系统方框图（含求和点、传函块、反馈回路、串并联结构）、信号流图（节点、有向边、增益）。

生成规范：
- 调用 tikz-control-draw 技能，提供系统结构描述，技能负责生成 TikZ/LaTeX 源码并编译为 300dpi PNG
- 脚本保存为 `drafts/draft-N/assets/gen_<name>.py`（调用编译接口），图片与脚本同目录
- **禁止用 matplotlib patches/arrows 手绘方框图或信号流图**

### 类型 C — 一般示意图（AI 生成，明确标注）

适用：定性概念示意、抽象原理图、非精确流程图、不需要物理精确的插图。

生成规范：
- **不生成实体图片文件**，在 `stem.md` 对应位置写注释占位：

```markdown
<!-- AI_IMAGE: <主要描述（中文，50字以内）> | Prompt: <英文生图提示词（含风格、构图、关键元素）> -->
```

示例：
```markdown
<!-- AI_IMAGE: 控制系统工程师在实验室调试PID控制器的示意图 | Prompt: A control systems engineer adjusting a PID controller in a modern laboratory, clean diagram style, educational illustration, white background -->
```

## 公式格式规范（全文强制）

| 类型 | 格式 | 示例 |
|------|------|------|
| 行内公式 | `$...$` | `$G(s) = \frac{K}{s+1}$` |
| 行间公式 | `$$...$$`（独占一行） | `$$G(s) = \frac{K}{Ts+1}$$` |

禁止使用 `\(...\)` 或 `\[...\]` 格式，禁止裸写数学表达式。

## `task-package.json`

```json
{
  "question_id": "T3-2",
  "question_type": "C",
  "difficulty": "⭐⭐",
  "title": "根轨迹基本规则应用",
  "ability": "手绘根轨迹草图（8条规则综合应用）",
  "assignment_total_score": 100,
  "assignment_score_policy": "HW1-HW6: 20 + 20 + 20 + 40",
  "question_score": 20,
  "synopsis": "......",
  "why_for_exam": "......",
  "output_requirements": {
    "must_include": ["stem", "answer", "inline_score_points", "rubric", "self_check"],
    "score_consistency": "inline_score_points、答案正文行内分值与 rubric 总分必须等于 question_score",
    "formula_format": "inline: $...$, block: $$...$$",
    "images": "三分类：仿真图→Python-control library；方框图/信号流图→tikz-control-draw技能；一般示意图→AI_IMAGE注释占位"
  },
  "consensus_rule": {
    "C": "最终数值结果一致，允许等价表达",
    "X": "所有分析项目都回答且方向基本一致",
    "D": "设计路线一致且结果满足题目要求"
  }
}
```

## `draft-N.json`（出题智能体输出）

每个出题智能体在 `drafts/draft-N/` 下输出 `draft-N.json` 和 `stem.md`：

```json
{
  "agent_role": "drafter",
  "draft_id": "draft-1",
  "stem_file": "drafts/draft-1/stem.md",
  "answer": "标准答案正文，且关键步骤/关键公式后直接带分值标记",
  "inline_score_points": [
    {
      "points": 2,
      "criterion": "写出关键中间结论或完成某一步判断",
      "inline_example": "$$ G(s)=\\\\frac{1}{s+1}.\\\\tag{2分} $$"
    }
  ],
  "rubric": [
    { "step": "步骤 1", "points": 4, "criteria": "得分标准" }
  ],
  "pitfalls": ["常见错误 1"],
  "assets": ["assets/step-response.png", "assets/bode-plot.png"],
  "self_check": {
    "self_contained": true,
    "gradable": true,
    "matches_question_type": true,
    "formulas_use_dollar_sign": true,
    "all_images_generated": true
  }
}
```

## `judge/draft-selection.json`（裁判智能体输出）

裁判在原有选题字段基础上新增图片核验和公式修正记录：

```json
{
  "selected_draft_id": "draft-2",
  "selection_reason": "最符合题号要求且题面自包含",
  "rejected": [
    { "draft_id": "draft-1", "reason": "评分标准不够可执行" },
    { "draft_id": "draft-3", "reason": "题面分析项与题号梗概不完全一致" }
  ],
  "needs_redraft": false,
  "image_checks": {
    "draft-2": [
      {
        "file": "assets/step-response.png",
        "content_correct": true,
        "font_readable": true,
        "axes_complete": true,
        "display_intact": true,
        "notes": ""
      }
    ]
  },
  "formula_fix": {
    "applied": true,
    "changes": [
      {
        "location": "题面第3行",
        "original": "G(s) = K/s",
        "fixed": "$G(s) = K/s$"
      }
    ]
  }
}
```

若 `needs_redraft` 为 `true`，重新跑出题轮次，不进入作答。

裁判完成选题和修正后，将选中草稿的 `stem.md`（已修正公式）和 `assets/` 复制到 `selected/`。

## `solver-N.json`（作答智能体输出）

```json
{
  "agent_role": "solver",
  "round": 1,
  "solver_id": "solver-1",
  "assumptions": ["如果题面未给出某参数，则采用......"],
  "analysis": "完整作答过程",
  "final_answer": "最终答案",
  "validation_notes": ["必填（凡涉及定量计算）：用 Python-control 验证了闭环极点 = -2±j3，与计算一致；验证脚本：assets/verify_solver-1.py"],
  "reference_plots": ["题面要求学生画响应图时必填：assets/step_response_ref.png"],
  "reference_diagrams": ["题面要求学生画方框图/信号流图时必填：assets/closed_loop_block.png"]
}
```

**字段说明：**

| 字段 | 必填条件 | 说明 |
|------|---------|------|
| `validation_notes` | 凡有定量计算（极点、性能指标、稳态误差等） | Python-control 仿真验证结论；验证脚本保存至 `solvers/round-N/assets/verify_<solver_id>.py` |
| `reference_plots` | 题面要求学生"画/绘制响应曲线/仿真图" | Python-control 生成的参考仿真图路径，保存至 `solvers/round-N/assets/` |
| `reference_diagrams` | 题面要求学生"画/绘制方框图/信号流图" | tikz-control-draw 技能生成的参考结构图路径，保存至 `solvers/round-N/assets/` |

## 一致性记录（`final-package.json` 中）

```json
{
  "consensus": {
    "passed": true,
    "question_type": "C",
    "rounds_used": 1,
    "majority_group": ["solver-1", "solver-3"],
    "reason": "三份答案最终数值一致"
  }
}
```

若首轮失败，`rounds_used` 记为 `2`，并说明第二轮占优依据。

## `final/final-package.md`（最终 Markdown 产物）

顺序固定为：

1. 题号 / 题型 / 难度
2. 最终题面（含图片引用，路径为 `../selected/assets/xxx.png`）
3. **图片资源清单**（新增）：列出所有图片文件名及其在题面中对应的位置
4. 标准答案
5. 分步评分标准
6. 参考作答
7. 裁判结论（含图片核验记录摘要和公式修正记录）
8. 一致性记录
9. 是否触发第二轮作答

图片资源清单格式示例：

```markdown
## 图片资源清单

| 文件名 | 位置 | 说明 |
|--------|------|------|
| step-response.png | 题面第 2 段 | 系统阶跃响应曲线 |
| bode-plot.png | 题面第 4 段 | Bode 图（幅频+相频） |
```

## 验收清单

- 临时目录在 `.tmp/homework-problem-authoring/<QUESTION_ID>/` 下
- 各出题智能体图片只存在于自己的 `drafts/draft-N/assets/` 中
- 选中草稿的图片已复制到 `selected/assets/`
- 题面自包含，不引用项目文件
- 所有公式使用 `$...$` 或 `$$...$$` 格式
- 裁判输出包含 `image_checks` 和 `formula_fix` 字段
- 标准答案覆盖题目所有子问
- 评分标准逐步可判分
- 参考作答来自独立作答智能体
- `C/X/D` 一致性标准使用正确
- 首轮不一致时已执行第二轮
- 两轮后仍不稳定的题已判废
- `final-package.md` 包含图片资源清单

### 图表三分类验收（新增）

- **类型 A（仿真图）**：所有响应曲线/Bode/根轨迹等仿真图使用 Python-control library 生成，不得用手工数据点；`gen_<name>.py` 脚本中含 `control.tf()` 或 `control.ss()` 构建
- **类型 B（结构图）**：所有方框图和信号流图通过 tikz-control-draw 技能生成，脚本中含对应编译调用
- **类型 C（示意图）**：一般示意图在 `stem.md` 中有 `<!-- AI_IMAGE: ... | Prompt: ... -->` 注释，无实体图片文件
- **答题仿真验证**：凡涉及定量计算的 solver-N.json 含非空 `validation_notes`，对应验证脚本存在于 `solvers/round-N/assets/`
- **答题参考图（响应类）**：题面含"画响应曲线/仿真"要求时，solver-N.json 含 `reference_plots` 且文件存在
- **答题参考图（结构类）**：题面含"画方框图/信号流图"要求时，solver-N.json 含 `reference_diagrams` 且文件存在
