# 单元 3-9 多模态资源设计与采用清单

> **当前阶段目标**：围绕同一船舶航向控制对象，保证 `3-9` 讲义、导入资源与跨域比较成图完全对齐。
> **资源总数**：12 项
> **命名前缀**：全部统一使用 `3-9-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/15.2根轨迹分析综合/README.md` | `pptx` | intro video 前段 / handout 对照骨架 | 改写吸收 + 图示骨架复用 | 必融入 | 负责统一对象与根轨迹后果回收，不滑入模块4设计任务 |
| `course-content/resource-library/pptx/21三频段_各司其职/README.md` | `pptx` | intro video 中后段 / handout 频域对照 | 改写吸收 | 必融入 | 负责“三频段 -> 带宽/裕度 -> 动态品质”的判断链 |
| `course-content/resource-library/pptx/23滞后超前/README.md` | `pptx` | intro video 后段 / handout 代价对照 | 改写吸收 | 必融入 | 只用于积分路线与滞后路线的代价对照，不做完整校正设计 |
| `course-content/resource-library/ship-control-cases/sections/5.1-船舶航向控制频域分析.md` | `ship-case` | intro video 全程 / handout 工程主对象 | 改写吸收 | 必融入 | 用同一船舶航向控制对象串起基准、积分、自选补强与滞后版本 |
| `course-content/resource-library/pptx/20宽备窄用_稳定裕度/README.md` | `pptx` | 本轮不接入 | 排除 | 排除 | 防止课堂滑回“稳定裕度专题复讲” |
| `course-content/resource-library/pptx/10.1校正_实现控制的手段/extracted.md` | `pptx` | 本轮不接入 | 排除 | 排除 | 防止课堂滑回“控制器种类清单” |

---

## 2. 资源总表

| 编号 | 文件名 / 标识 | 生成方式 | 引用于 | 优先级 |
| :---: | --- | --- | --- | :---: |
| 1 | `3-9-cover-comic.png` | AI 静态图 | `handout.md` 首页 / interactive step-01 | P0 |
| 2 | `3-9-cover-comic-prompt.md` | 提示词文稿 | 封面图生成依据 | 已有 |
| 3 | `3-9-intro-video.mp4` | AI 视频 | Bridge-in / interactive step-01 | P0 |
| 4 | `3-9-intro-video-prompts.md` | 提示词文稿 | 视频生成依据 | 已有 |
| 5 | `3-9-baseline-quad.png` | `Octave` 数据 + Python 成图 | handout 基准版本 / interactive step-03 | P1 |
| 6 | `3-9-zero-line-quad.png` | `Octave` 数据 + Python 成图 | handout 零点线补强 / interactive step-04 | P1 |
| 7 | `3-9-integral-weak-quad.png` | `Octave` 数据 + Python 成图 | handout 弱积分 / interactive step-05 | P1 |
| 8 | `3-9-integral-strong-quad.png` | `Octave` 数据 + Python 成图 | handout 强积分 / interactive step-05 | P1 |
| 9 | `3-9-integral-corrected-quad.png` | `Octave` 数据 + Python 成图 | handout 积分校正 / interactive step-05 | P1 |
| 10 | `3-9-lag-quad.png` | `Octave` 数据 + Python 成图 | handout 滞后对照 / interactive step-06 | P1 |
| 11 | `3-9-info.png` | 信息图 | handout 小结 / interactive step-08 | P0 |
| 12 | `3-9-slides.pdf` | 课件导出 | 课前预习 / runtime 媒体索引 | P0 |

---

## 3. 已有与待生成文稿

### 3.1 已有导入视频提示词

- **文件**：`media/raw/3-9-intro-video-prompts.md`
- **用途**：用于生成“模块3出口综合映射型”导入短视频
- **画面主轴**：同一船舶航向控制对象的基准、积分、自选补强、教师演示滞后四版本连续比较

### 3.2 已有封面提示词

- **文件**：`media/raw/3-9-cover-comic-prompt.md`
- **用途**：生成讲义首页封面漫画
- **画面主轴**：同一艘船在基准、积分、自选补强、滞后四版本之间切换，收束为“先分配任务，再选机制线”

### 3.3 提示词当前默认口径

- 学生自选补强版本，默认拍成“零点线补强版”，因为视觉差异比极点线更直接。
- 若后续要切为“极点线补强版”，保持同一对象、同一分镜，只替换第三段模块与曲线后果，不重写整支视频。

### 3.4 已有代码直出图

- **`3-9-baseline-quad.png`**
  - 内容：基准版本的 `2×2` 跨域图
  - 作用：给后续所有版本提供统一锚点
- **`3-9-zero-line-quad.png`**
  - 内容：零点线补强版的 `2×2` 跨域图
  - 作用：支撑“更偏动态改善”的任务标签判断
- **`3-9-integral-weak-quad.png` / `3-9-integral-strong-quad.png` / `3-9-integral-corrected-quad.png`**
  - 内容：积分家族三版本跨域比较
  - 作用：支撑“低频收益与中频代价同时暴露”的主线
- **`3-9-lag-quad.png`**
  - 内容：滞后对照版本的 `2×2` 跨域图
  - 作用：补上“稳态改善的另一条路径”
- **`3-9-info.png`**
  - 内容：本课综合映射总结信息图
  - 作用：支撑模块 4 入口判断收束

---

## 4. 视频提示词设计约束

1. 画面必须围绕同一对象连续比较，不能换案例拼盘。
2. 主线必须是“回收 `3-8` 频域语言 -> 基准/积分/自选补强比较 -> 滞后版本补强 -> 任务标签收束”。
3. 重点是综合映射与比较，不是再讲一轮新机制，更不是模块4的设计流程。
4. 必须拍出“同样想改善性能，但不同机制线优先解决的问题不同、代价暴露的位置不同”。
5. 严禁出现稳定裕度专题复讲、控制器名单罗列、唯一最优方案、完整参数整定或大段公式教学。

---

## 5. 后续执行建议

1. `interactive-page.md` 的入口步骤应直接承接导入视频后的“先贴任务标签，再做跨域验证”。
2. 后续若重生成数值图，继续沿用 `media/raw/generate_design_data.m` 与 `media/raw/render_figures.py` 的两段式流程，不另起新命名。
3. 本文件后续只维护已经落盘、且会被讲义或互动页直接引用的媒体；不再保留未生成的占位资源名。
