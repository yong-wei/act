# 项目说明：自动控制原理课程重构

## 项目目的

本项目为"自动控制原理"课程（66学时+6学时实验，4.5学分）从零创作完整教学内容包。课程采用5层+复习的新单元体系，依托 AI-OBE 船舶智控平台，以"先见森林，再见树木"为核心设计原则。

## 目录结构

```
course-content/
├── authoring/                   # 作者态真源（Claude 的工作目录）
│   ├── lessons/                 # 以课次为第一维度
│   │   └── L-2a/
│   │       ├── manifest.json    # 课次元数据与路径索引
│   │       ├── design/          # 设计文档
│   │       │   ├── handout.md
│   │       │   ├── boppps.md
│   │       │   ├── interactive-page.md
│   │       │   └── multimedia.md
│   │       ├── graph/           # 本课次图谱增量
│   │       │   ├── nodes.jsonl
│   │       │   ├── relations.jsonl
│   │       │   └── card-refs.json
│   │       ├── cards/           # 卡片编排
│   │       │   ├── sequence.json
│   │       │   └── overrides/
│   │       ├── media/           # 媒体文件
│   │       │   ├── raw/         # 源文件（.py 代码、原始图、录屏母版）
│   │       │   └── processed/   # 发布候选（.svg/.png，压缩后）
│   │       └── notes/           # 实施备注
│   ├── knowledge/               # 知识视角（跨课次）
│   │   ├── base/                # 全局图谱基线
│   │   ├── overlays/            # 各课次图谱增量镜像
│   │   └── cards/nodes/         # 知识卡片库
│   └── shared/                  # 共享资源
│       ├── SyllabusRefactor.md
│       └── schema/
├── runtime/                     # 运行态（由 Codex/export-runtime.sh 生成，Claude 不直接写入）
├── scripts/                     # export-runtime.sh（由 Codex 实现）
├── docs/                        # 面向 Claude 的规范与参考文档
└── .claude/                     # Claude 本地配置与专用技能
    └── skills/lesson/           # 课程内容创作技能（当前生效版本）
```

## 职责边界

**Claude 负责**：`authoring/` 下的原始产物生成与维护、`docs/` 文档更新、`.claude/` 技能维护。

**Claude 不承担**：平台运行 JSON 生成、`runtime/` 写入、与主项目 `src/` 的接线。详见 `docs/COURSE_CONTENT_CLOSED_LOOP.md`。

## 工作原则

### 内容创作原则

1. **讲义优先**：讲义是面向学生的唯一权威来源，自成体系，不引用平台操作或课堂活动
2. **衍生顺序**：讲义 → 教案（BOPPPS）→ 互动页面 → 多模态资源
3. **速通单元标注**：层0单元（L-2a~L-2d）中所有"先用不推导"内容须标注"→ 完整推导见单元X-X"
4. **AI融入点设计**：递进式人机协同（预测→AI对比→AI绘图验证→反思），不是简单"问AI"

### 多媒体制作原则

媒体资源按**用途**（讲义 `h` / 互动课 `ic` / 共用 `sh`）和**生成方式**分类：

| 生成方式 | 判断标准 | 产出 |
|----------|----------|------|
| 代码直出图 | 响应曲线、根轨迹、Bode图、框图、信号流图等可矢量化图形 | 内容描述 + Python 示例代码 |
| 位图（AI生成） | 原理示意图、工程场景图、实物图 | 场景描述 + 英文生图提示词 |
| 互动前端绘制 | 互动课中需随参数动态变化的图表 | 前端绘制需求描述（无媒体文件） |
| 视频 | 仅互动课，动态演示 | Sora 提示词 |

**文件命名**：`{用途前缀}-{两位序号}-{简短描述}.{ext}`，例如 `h-01-step-response-family.py`

**文件存储**：`.py` 源文件和 AI 原始图 → `media/raw/`；产出 SVG/PNG、压缩后版本 → `media/processed/`

**引用回写**：Step 7 完成后，将 `![图注](../media/processed/{文件名})` 插入 handout.md 和 interactive-page.md 对应位置。

### 技能使用原则

- 课程创作技能：`.claude/skills/lesson/SKILL.md`（当前生效，v2.1）
- 技能以批判性教学专家身份参与，不全盘接受设计方案，主动指出认知负担和逻辑问题

### 笔记更新原则

- 每次会话结束前更新 `notes/progress.md`（当前进度、下次续接点）
- 重要设计决策追加到 `notes/discussion-log.md`

## 单元编号体系（v3.0）

| 层次 | 单元编号 | 学时 |
|:---:|---------|:----:|
| 层0 框架建构期 | L-0, L-1, L-AI, L-2a, L-2b, L-2c, L-2d, L-∑ | 16h |
| 层1 数学语言精化 | 1-1, 1-2, 1-3, 习题课1 | 8h |
| 层2 三域融通精化 | 2-1, 2-2, 2-3, 2-4, 2-5, 2-中测, 习题课2 | 14h |
| 层3 工程设计精化 | 3-1, 3-2, 3-3, 3-4, 3-5, 3-6 | 12h |
| 层4 前沿拓展 | 4-1, 4-2, 4-3, 4-4 | 8h |
| 习题课3+复习 | 习题课3, R-1, R-2, R-3 | 8h |

# currentDate
Today's date is 2026-03-17.

## Quick Commands

```bash
# 课程导出（由 Codex 实现）
./course-content/scripts/export-runtime.sh

# 查看课程创作技能
cat .claude/skills/lesson/SKILL.md
```
