# 多模态资源设计 | 单元 3-2：劳斯判据——从高阶系统稳定判定到参数可行域

本单元的媒体设计围绕同一个四阶对象展开，目标不是堆叠图像数量，而是让学生在不同表述之间看到同一条稳定边界：代数上由劳斯表给出，复平面上表现为极点逼近或穿越虚轴，时域和频域上则表现为响应与峰值的变化。现有资源已经能够覆盖这条主线，不再额外生成同义图。

本单元正式媒体共 11 项，另保留 2 份提示词文件；控制图像统一以 `Octave + control` 为真值来源，正式成品均使用 `3-2-` 前缀。

---

## 一、资源采用说明

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 说明 |
|---|---|---|---|---|---|
| `course-content/resource-library/pptx/8稳定_控制系统首要任务/README.md` | `pptx` | 讲义正文、课堂导入、特殊情况方法卡 | 改写吸收 | 必融入 | 吸收劳斯判据主线、特殊情况辨识和参数区间表达，不沿用旧例题铺陈方式 |
| `course-content/questions/questions/AC-Q-0048.md` | `exercise` | 参数扫描与图 1-3 的数值核验 | 改写吸收 | 必融入 | 用于支撑参数变化、典型响应和趋势判断 |
| `course-content/questions/questions/AC-Q-0046.md` | `exercise` | 特殊情况辨识 | 改写吸收 | 必融入 | 用于区分 `首位为 0` 与 `全零行` 两种处理方式 |
| `course-content/resource-library/civics-cases/cases/03-数理交响启示录.md` | `civics` | 附录 A | 改写吸收 + 复用配图 | 可选融入 | 只服务“数学工具进入工程判断”的价值收束，不干扰正文主线 |
| `course-content/resource-library/pptx/11放眼大局_根轨迹法/README.md` 等根轨迹资源 | `pptx` | 无 | 排除 | 排除 | 本课只讨论稳定边界与可行域，不提前展开根轨迹法则体系 |

---

## 二、命名与目录

- 原料目录：`media/raw/`
- 成品目录：`media/processed/`
- 已有脚本：
  - `media/raw/3-2-generate-plots.m`
  - `media/raw/3-2-generate-reference-cards.py`
- 命名规则：所有正式成品统一使用 `3-2-...`

这一命名方式的意义不只是归档整齐，更是为了保证讲义、教师版讲义、互动页和运行时资源引用同一批资产，不再出现同一内容多份近义文件。

---

## 三、正式资源总表

| 编号 | 文件名 | 类型 | 引用位置 | 资源作用 |
|:---:|---|---|---|---|
| 1 | `3-2-pole-migration.png` | 代码直出图 | `handout` §3、§6；`boppps` 导入；`interactive-page` 步骤 2、7 | 把代数区间、极点迁移和区域约束放到同一张图上 |
| 2 | `3-2-step-comparison.png` | 代码直出图 | `handout` §5；`boppps` 三域对应；`interactive-page` 步骤 10 | 展示稳定、临界、失稳三种时域表现 |
| 3 | `3-2-bode-magnitude.png` | 代码直出图 | `handout` §5；`boppps` 三域对应；`interactive-page` 步骤 11 | 展示接近稳定边界时频域峰值的抬高 |
| 4 | `3-2-special-cases-card.svg` | 方法卡 | `handout` §4；`interactive-page` 步骤 8、9；`boppps` 特殊情况段 | 并列呈现两类特殊情况的判断与处理 |
| 5 | `3-2-parameter-range-flow.svg` | 流程图 | `handout` §6；`interactive-page` 步骤 12 | 固定“写方程—列劳斯表—合并区间—变量平移”的求解链 |
| 6 | `3-2-cover-comic.png` | 讲义封面图 | 讲义封面；互动课入口 | 提供统一视觉入口 |
| 7 | `3-2-info.png` | 讲义信息图 | 讲义总结；互动课收束页 | 汇总本课关键对象与判断链 |
| 8 | `3-2-slides.pdf` | 课件 | 课堂投屏；课件归档 | 服务课堂展示与归档回看 |
| 9 | `3-2-intro-video.mp4` | 导入视频 | 课堂开场；互动课首页 | 形成进入问题的情境 |
| 10 | `3-2-course.mp4` | 课程视频 | 课程归档；回看入口 | 提供课后回看材料 |
| 11 | `3-2-audio.m4a` | 音频播客 | 音频归档 | 服务碎片化复习与回听 |

提示词文件：

- `media/raw/3-2-cover-comic-prompt.md`
- `media/raw/3-2-intro-video-prompts.md`

---

## 四、核心图像与原料映射

| 标识 | 原料文件 | 成品文件 | 工具 | 教学作用 |
|---|---|---|---|---|
| `pp-01` | `media/raw/3-2-generate-plots.m` | `media/processed/3-2-pole-migration.png` | Octave | 说明参数变化下的极点迁移范围，并把稳定区间与区域约束转成几何直觉 |
| `pp-02` | `media/raw/3-2-generate-plots.m` | `media/processed/3-2-step-comparison.png` | Octave | 比较稳定、临界、失稳三种时间响应 |
| `pp-03` | `media/raw/3-2-generate-plots.m` | `media/processed/3-2-bode-magnitude.png` | Octave | 说明接近稳定边界时频域峰值为何上扬 |
| `pp-04` | `media/raw/3-2-generate-reference-cards.py` | `media/processed/3-2-special-cases-card.svg` | Python + matplotlib mathtext | 固定两类特殊情况的辨识与处理动作 |
| `pp-05` | `media/raw/3-2-generate-reference-cards.py` | `media/processed/3-2-parameter-range-flow.svg` | Python + matplotlib mathtext | 固定参数可行域的推导顺序与区域约束入口 |

其中 `pp-01` 是本课的主图。它负责把“参数区间”“极点结构”“区域筛选”三件事同时讲清。`pp-02` 与 `pp-03` 则共同承担三域对应，二者应始终配对出现，不宜单独抽离使用。

---

## 五、课程级资源

| 资源 | 正式文件名 | 当前用途 |
|---|---|---|
| 封面图 | `3-2-cover-comic.png` | 讲义封面与互动课入口 |
| 信息图 | `3-2-info.png` | 讲义总结与互动课收束页 |
| 课件 | `3-2-slides.pdf` | 课堂投屏与归档 |
| 导入视频 | `3-2-intro-video.mp4` | 课堂开场与互动首页 |
| 课程视频 | `3-2-course.mp4` | 回看入口 |
| 音频播客 | `3-2-audio.m4a` | 音频归档与复习 |

这些课程级资源不承担细部推导说明，主要负责入口、收束和回看。真正用于概念辨析和方法判断的，仍是前述五项核心图像资源。

---

## 六、复用原则

- `3-2-pole-migration.png` 在正文、教师版讲义和互动页中应保持同一图意，不另起近义版本。
- `3-2-step-comparison.png` 与 `3-2-bode-magnitude.png` 应成对出现，避免把三域链条拆开。
- `3-2-special-cases-card.svg` 适合承担固定说明板的角色，不再把同一内容改写成另一张方法图。
- 附录 A 若使用课程思政案例配图，直接复用上游资产，不在本单元重复生成副本。

这样处理之后，媒体系统会更像一组互相支撑的证据，而不是一串彼此竞争注意力的文件清单。
