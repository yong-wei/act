# 单元 2-2 创作进度

## 当前状态：✅ 已完成 runtime 导出、精品互动课首轮落地与增强版工作区补强

## 完成清单

| Step | 产物 | 状态 |
|:---:|:---:|:---:|
| Step 3 | `design/handout.md` | ✅ 已完成，含例题、思政、小结、附录速查表 |
| Step 4 | `manifest.json` / `graph/*.jsonl` / `sequence.json` | ✅ 已完成，新增 3 个节点 |
| Step 4 | 新增节点卡片 | ✅ 已完成，写入 `authoring/knowledge/cards/nodes/` |
| Step 5 | `design/boppps.md` | ✅ 已完成 |
| Step 6 | `design/interactive-page.md` | ✅ 已完成，17 步双视角蓝图 |
| Step 7 | `design/multimedia.md` | ✅ 已完成，13 项资源规格 |

## 本轮验证与修正

- 已完成 `manifest.json`、`sequence.json`、`graph/nodes.jsonl`、`graph/relations.jsonl` 的 JSON/JSONL 结构校验；
- 已完成 `interactive-page.md` 与 `sequence.json` 的 `step-01` ~ `step-17` 对齐检查；
- 已完成 `handout.md`、`interactive-page.md`、`multimedia.md` 的媒体命名一致性检查；
- 已修正 2 张新增知识卡片中的 heredoc 转义污染（`\frac` / `\to`）；
- 已执行 `python3 .codex/skills/lesson/scripts/sync_overlays.py 2-2`，并复检通过。

## 本轮新增落地产物

- 已新增媒体生成基线：`authoring/lessons/2-2/media/raw/matplotlib_font.py`、`authoring/lessons/2-2/media/raw/td_math.py`；
- 已生成高优先级静态素材 `td-01` ~ `td-04`，写入 `authoring/lessons/2-2/media/processed/`；
- 已补齐剩余静态素材：
  - `authoring/lessons/2-2/media/processed/td-05-example-response-with-indices.svg`
  - `authoring/lessons/2-2/media/processed/td-06-time-spec-to-pole-region.svg`
- 已新增对应源脚本：
  - `authoring/lessons/2-2/media/raw/td-01-time-domain-input-response-overview.py`
  - `authoring/lessons/2-2/media/raw/td-02-first-order-step-time-constant.py`
  - `authoring/lessons/2-2/media/raw/td-03-second-order-response-families.py`
  - `authoring/lessons/2-2/media/raw/td-04-time-domain-indices-annotated.py`
  - `authoring/lessons/2-2/media/raw/td-05-example-response-with-indices.py`
  - `authoring/lessons/2-2/media/raw/td-06-time-spec-to-pole-region.py`
- 已新增互动实现说明：`authoring/lessons/2-2/notes/interactive-implementation.md`，覆盖 `ic-02`、`ic-03`、`ic-04`、`ic-06`、`ic-07` 的状态、控制与埋点。
- 已完成 `course-content/runtime/lessons/2-2/` 导出，包含 `lesson.json`、`graph-overlay.json`、`handout.md`、`review/*` 与 6 张 SVG 代码直出媒体。
- 已落地互动课程入口页、教师端、学生端、AI 上下文、课程总入口注册与教师预置教案。
- 已完成增强版工作区补强：
  - `step-07`：补齐“参数名 / 数学式 / 控制现象”三列表；
  - `step-09`：补齐四指标叠加总览工作区；
  - `step-13`：补齐例题三步法计算面板，并显式展示 `wd` 中间量。

## 本课新增节点

- `无阻尼自然频率_3_13001`
- `阻尼振荡频率_3_13002`
- `时域指标到极点参数映射_3_13003`

## 本轮待后续执行项

- 建议补一次真实教师端 session 验收，重点检查释放活动、显示答案、结束课堂与学生端不同步提示；
- 若继续打磨精品度，可进一步提升 `step-07`、`step-09`、`step-13` 的视觉密度与教师端课堂控制反馈。
