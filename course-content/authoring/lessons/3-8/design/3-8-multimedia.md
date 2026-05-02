# 单元 3-8 多模态资源设计与采用清单

> **当前阶段目标**：对齐新版学生版讲义、教师版讲义与互动课程设计，形成可直接支撑 `3-8` 全课判断链的正式媒体包。
> **命名前缀**：全部统一使用 `3-8-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/16频率特性_换个角度看控制/README.md` | `pptx` | intro video / handout 导入 | 改写吸收 | 必融入 | 只负责“为什么需要频域语言”的导入，不回退到频响基础重讲 |
| `course-content/resource-library/pptx/19稳定判据_频域的启示/README.md` | `pptx` | intro video 主体 / handout §判稳 | 改写吸收 | 必融入 | 服务 `Nyquist` 判稳与 `(-1,j0)` 视觉中心，不做旧章节串讲 |
| `course-content/resource-library/pptx/21三频段_各司其职/README.md` | `pptx` | intro video 后段 / handout §三频段 | 改写吸收 + 图示骨架复用 | 必融入 | 用于压实低频/中频/高频分工与带宽、裕度读回 |
| `course-content/resource-library/ship-control-cases/sections/5.1-船舶航向控制频域分析.md` | `ship-case` | intro video 收束 / handout 案例 | 改写吸收 | 必融入 | 负责把相角裕度、带宽读回航向控制超调与调节时间 |
| `course-content/resource-library/ship-control-cases/sections/5.3-船载稳定平台控制系统频域分析.md` | `ship-case` | intro video 收束 / handout 对照案例 | 改写吸收 | 必融入 | 负责把谐振峰值、相角裕度读回平台伺服快慢与超调 |
| `course-content/resource-library/civics-cases/cases/06-频段强国策应器.md` | `civics` | intro video 气质补强 | 仅作灵感 | 可选融入 | 只借“不同频段承担不同任务”的系统级视角，不写成独立思政段落 |
| `course-content/resource-library/pptx/17近似叠加_绘制伯德图/README.md` | `pptx` | 本轮不接入 | 排除 | 排除 | 主价值属于模块2的作图训练，不能侵蚀 `3-8` 的“翻译优先”定位 |
| `course-content/resource-library/pptx/18幅相特性_换个角度看频域/README.md` | `pptx` | 本轮不接入 | 排除 | 排除 | 主价值属于模块2的读图基础，不在本课重新展开 |

---

## 2. 正式媒体总表

| 编号 | 文件名 / 标识 | 生成方式 | 引用于 | 优先级 |
| :---: | --- | --- | --- | :---: |
| 1 | `3-8-cover-comic.png` | AI 静态图 | `handout.md` 首页 / `interactive-page.md` `step-01` | P0 |
| 2 | `3-8-intro-video.mp4` | AI 视频 | Bridge-in / `interactive-page.md` `step-01` | P0 |
| 3 | `3-8-gain-effect.png` | `Octave` + `Python/matplotlib` | handout §2.2.1 / `interactive-page.md` `step-02` | P0 |
| 4 | `3-8-zero-effect.png` | `Octave` + `Python/matplotlib` | handout §2.2.2 / `interactive-page.md` `step-02` | P0 |
| 5 | `3-8-pole-effect.png` | `Octave` + `Python/matplotlib` | handout §2.2.3 / `interactive-page.md` `step-02` | P0 |
| 6 | `3-8-rhp-zero-effect.png` | `Octave` + `Python/matplotlib` | handout §2.2.4 / `interactive-page.md` `step-02` | P0 |
| 7 | `3-8-nyquist-quickcheck.png` | `Octave` + `Python/matplotlib` | handout 例题 2 / `interactive-page.md` `step-07` | P0 |
| 8 | `3-8-nyquist-example.png` | `Octave` + `Python/matplotlib` | handout 例题 3 / `interactive-page.md` `step-07` | P0 |
| 9 | `3-8-bode-example.png` | `Octave` + `Python/matplotlib` | handout §2.4 / `interactive-page.md` `step-08` | P0 |
| 10 | `3-8-three-band-overview.png` | `Octave` + `Python/matplotlib` | handout §2.5 / `interactive-page.md` `step-09` | P0 |
| 11 | `3-8-heading-baseline.png` | `Octave` + `Python/matplotlib` | handout §2.6.1 / `interactive-page.md` `step-10` | P0 |
| 12 | `3-8-heading-case.png` | `Octave` + `Python/matplotlib` | handout §2.6.1 / `interactive-page.md` `step-10` | P0 |
| 13 | `3-8-platform-block-diagram.png` | TikZ 线框图 | handout §2.6.2 / `interactive-page.md` `step-11` | P0 |
| 14 | `3-8-platform-baseline.png` | `Octave` + `Python/matplotlib` | handout §2.6.2 / `interactive-page.md` `step-11` | P0 |
| 15 | `3-8-platform-case.png` | `Octave` + `Python/matplotlib` | handout §2.6.2 / `interactive-page.md` `step-11` | P0 |
| 16 | `3-8-info.png` | 代码直出信息图 | handout 课末 / `interactive-page.md` `step-12` | P0 |
| 17 | `3-8-slides.pdf` | 课程级占位资源 | runtime 预习/课堂配套 | P1 |
| 18 | `3-8-course.mp4` | 课程级占位资源 | runtime 课程视频入口 | P1 |
| 19 | `3-8-audio.m4a` | 课程级占位资源 | runtime 音频入口 | P1 |

---

## 3. 已有脚本与提示词入口

### 3.1 已有导入视频提示词

- **文件**：`media/raw/3-8-intro-video-prompts.md`
- **用途**：用于生成“频域翻译器型”导入短视频
- **画面主轴**：同一控制对象的结构变化，在 `Bode` 曲线、`Nyquist` 轨迹、三频段分工和闭环后果上留下不同痕迹

### 3.2 已有封面提示词

- **文件**：`media/raw/3-8-cover-comic-prompt.md`
- **用途**：生成讲义首页封面漫画
- **画面主轴**：同一艘船的多种结构变化最终被 `Nyquist` 危险点与三频段总图统一翻译

### 3.3 数值图与结构图生成入口

- **`media/raw/3-8-frequency-translation-validation.m`**
  - 用途：统一核验增益、零点、积分、非最小相、Nyquist、Bode 与两组工程案例的数值结论
- **`media/raw/3-8-handout-figures.m`**
  - 用途：输出讲义正文使用的频域指纹图、Nyquist 快判图、Bode 图与工程案例图
- **`media/raw/generate_design_data.m`**
  - 用途：导出最终排版所需的结构化数据
- **`media/raw/render_figures.py`**
  - 用途：按 `3-6` 统一风格完成 PNG 排版
- **`media/raw/3-8-platform-block-diagram.tex`**
  - 用途：生成稳定平台案例控制框图

---

## 4. 视频提示词设计约束

1. 画面主线必须是“结构变化翻译 -> 判稳语言统一 -> 闭环性能读回 -> 模块4入口收束”，不能拍成知识点平铺。
2. `Nyquist` 曲线与 `(-1,j0)` 必须成为视觉中心之一，明确“判稳”戏剧感。
3. 三频段必须具备任务分工感：低频看精度与稳态，中频看穿越与相位裕度，高频看代价与保守性。
4. 工程案例只能做判断链验证，不能偷渡完整设计结论。
5. 严禁出现手工绘图教学、黑板推公式、控制器选型清单或模块4级别参数整定画面。

---

## 5. 后续执行建议

1. 先用 `media/raw/3-8-intro-video-prompts.md` 生成 15 秒导入视频，优先验证“`Nyquist` 临界点 + 三频段 + 双案例切换”三处画面是否稳定。
2. 若即梦对公式或坐标渲染不稳定，优先改成“无字曲线 + 色带 + 仪表灯”表达，不要强行堆砌可读文字。
3. 教师版讲义导出后，媒体包应以 `gain / zero / pole / rhp-zero / Nyquist / Bode / three-band / heading / platform / info` 这组正式文件名作为审查口径，不再沿用旧的 `double-ship-frequency-compare` 表述。
