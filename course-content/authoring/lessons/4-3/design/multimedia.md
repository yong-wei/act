# 单元 4-3 多模态资源设计与采用清单

> **当前阶段目标**：围绕“对象分析 -> 结构分流 -> 参数方向 -> 首轮验证 -> 问题清单”组织正式媒体，优先支撑复合结构分工、客船案例首轮验证和扰动抑制边界案例，不把资源重心拖回方法百科。
> **命名前缀**：全部统一使用 `4-3-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/22串联校正/README.md` | `pptx` | 复合结构三种写法、参数方向表达 | 改写吸收 | 必融入 | 只吸收结构职责与整定思路，不沿旧课件逐页展开 |
| `course-content/resource-library/pptx/23滞后超前/README.md` | `pptx` | `PI + 超前`、`滞后 + 超前` 的职责分工 | 改写吸收 | 必融入 | 只服务结构分流与参数方向，不重开完整校正理论专题 |
| `course-content/resource-library/ship-control-cases/sections/6.1-船舶航向控制频域校正.md` | `ship-case` | 客船航向保持主案例 | 改写吸收 | 必融入 | 只服务对象分析、超前初始方案和首轮验证，不提前进入 4-4 优化 |
| `course-content/resource-library/ship-control-cases/sections/6.2-船舶横摇减摇鳍控制系统设计.md` | `ship-case` | 横摇减摇鳍边界案例 | 改写吸收 | 必融入 | 只服务“扰动抑制中的通道重写边界”，不扩展成完整专题 |
| `course-content/resource-library/pptx/20宽备窄用_稳定裕度/README.md` | `pptx` | 首轮验证中的相角裕度解释 | 仅作灵感 | 可选融入 | 保留“离边界还有多远”的语言，不重开稳定裕度计算课 |

---

## 2. 本课正式媒体总表

| 编号 | 文件名 | 类型 | 状态 | 用途 |
| :---: | --- | --- | --- | --- |
| 1 | `4-3-cover-comic.png` | 封面图 | 已有 | 讲义首页导入 |
| 2 | `4-3-pi-lead-compound-quad.png` | 四联图 | 已有 | 说明 `PI + 超前` 的职责分工 |
| 3 | `4-3-lag-lead-compound-quad.png` | 四联图 | 已有 | 说明 `滞后 + 超前` 的职责分工 |
| 4 | `4-3-pid-compound-quad.png` | 四联图 | 已有 | 说明带微分滤波 `PID` 的一体化表达 |
| 5 | `4-3-heading-case-quad.png` | 四联图 | 已有 | 客船航向保持首轮验证主图 |
| 6 | `4-3-roll-fin-compensation-structure.png` | 结构图 | 已有 | 横摇减摇鳍边界案例的通道表达 |
| 7 | `4-3-roll-boundary-compare.png` | 对照图 | 已有 | 横摇边界案例效果比较 |
| 8 | `4-3-info.png` | 信息图 | 已有 | 讲义尾部总收束 |
| 9 | `4-3-media.md` | 媒体索引 | 已有 | runtime / 预习资源统一入口 |

---

## 3. 原始脚本与生成入口

### 3.1 数值数据与四联图

- **Octave 脚本**：`media/raw/generate_compound_design_data.m`
- **Python 排版脚本**：`media/raw/render_compound_figures.py`
- **用途**：
  - 统一生成 `PI + 超前`、`滞后 + 超前`、带微分滤波 `PID` 与客船航向案例的时域/频域/根轨迹数据；
  - 保证讲义中的数值结论与图像来源一致。

### 3.2 封面与导入视频

- **封面提示词**：`media/raw/4-3-cover-comic-prompt.md`
- **导入视频提示词**：`media/raw/4-3-intro-video-prompts.md`
- **用途**：
  - 统一“从对象分析走向首轮验证”的导入口径；
  - 保持讲义、课程视频和课程级资源的叙事一致。

---

## 4. 媒体设计约束

1. 正文主图必须服务“方案怎样落地”，不服务“方法大全式罗列”。
2. 所有四联图都要围绕“结构职责 -> 结果变化 -> 代价解释”阅读，不允许只展示漂亮曲线。
3. 客船主案例图必须同时支撑调节时间、超调量、相角裕度和控制峰值四类读数。
4. 横摇减摇鳍图只承担边界提醒：复合结构有时来自通道重写，不再额外扩展复杂推导。
5. 课程级媒体索引继续只保留统一的 5 个条目：`4-3-intro-video.mp4`、`4-3-slides.pdf`、`4-3-course.mp4`、`4-3-audio.m4a`、`handout.md`。

---

## 5. 当前建议补做的媒体

- 本轮作者态整改不新增阻断性正式媒体；现有封面图、四联图、结构图、信息图已足以支撑讲义、教案与 runtime 导出。
- 若后续进入互动课程设计，建议优先补两类状态媒体：
  - `4-3-parameter-direction-template.png`：参数方向表达卡模板；
  - `4-3-issue-handover-template.png`：问题清单移交表模板。

---

## 6. 课程级资源索引对接

- 统一媒体索引文件：`media/processed/4-3-media.md`
- 统一讲义下载源：`design/handout.pdf`
- 后续进入 runtime 导出时继续沿用：
  - `handout.md` 在线阅读；
  - `handout.pdf` 静态下载；
  - `4-3-media.md` 提供课程级资源入口与说明。
