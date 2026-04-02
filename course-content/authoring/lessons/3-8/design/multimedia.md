# 单元 3-8 多模态资源设计与采用清单

> **当前阶段目标**：先落 `3-8` 导入视频提示词，服务“频域翻译器”课堂开场。
> **资源总数**：6 项
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

## 2. 资源总表

| 编号 | 文件名 / 标识 | 生成方式 | 引用于 | 优先级 |
| :---: | --- | --- | --- | :---: |
| 1 | `3-8-cover-comic.png` | AI 静态图 | `handout.md` 首页 / interactive step-01 | P0 |
| 2 | `3-8-cover-comic-prompt.md` | 提示词文稿 | 封面图生成依据 | 已有 |
| 3 | `3-8-intro-video.mp4` | AI 视频 | Bridge-in / interactive step-01 | P0 |
| 4 | `3-8-intro-video-prompts.md` | 提示词文稿 | 视频生成依据 | 已有 |
| 5 | `3-8-three-band-overview.png` | 代码直出图 | handout §三频段 / interactive 中段 | P1 |
| 6 | `3-8-double-ship-frequency-compare.png` | 代码直出图 | handout 收束 / interactive 后段 | P1 |

---

## 3. 已有与待生成文稿

### 3.1 已有导入视频提示词

- **文件**：`media/raw/3-8-intro-video-prompts.md`
- **用途**：用于生成“频域翻译器型”导入短视频
- **画面主轴**：同一控制对象的结构变化，在 `Bode` 曲线、`Nyquist` 轨迹、三频段分工和闭环后果上留下不同痕迹

### 3.2 已有封面提示词

- **文件**：`media/raw/3-8-cover-comic-prompt.md`
- **用途**：生成讲义首页封面漫画
- **画面主轴**：同一艘船的多种结构变化最终被 `Nyquist` 危险点与三频段总图统一翻译

### 3.3 待补代码直出图

- **`3-8-three-band-overview.png`**
  - 内容：低频/中频/高频三段任务分工总图
  - 作用：为视频后段与讲义正文提供静态骨架
- **`3-8-double-ship-frequency-compare.png`**
  - 内容：船舶航向控制与船载稳定平台的频域量回读对照
  - 作用：支撑“同样是频域图，任务重点不同”的工程收束

---

## 4. 视频提示词设计约束

1. 画面主线必须是“结构变化翻译 -> 判稳语言统一 -> 闭环性能读回 -> 模块4入口收束”，不能拍成知识点平铺。
2. `Nyquist` 曲线与 `(-1,j0)` 必须成为视觉中心之一，明确“判稳”戏剧感。
3. 三频段必须具备任务分工感：低频看精度与稳态，中频看穿越与相位裕度，高频看代价与保守性。
4. 工程案例只能做判断链验证，不能偷渡完整设计结论。
5. 严禁出现手工绘图教学、黑板推公式、控制器选型清单或模块4级别参数整定画面。

---

## 5. 后续执行建议

1. 先用 `media/raw/3-8-intro-video-prompts.md` 生成 15 秒导入视频，优先验证“`Nyquist` 危险点 + 三频段 + 双船回读”三处画面是否稳定。
2. 若即梦对公式或坐标渲染不稳定，优先改成“无字曲线 + 色带 + 仪表灯”表达，不要强行堆砌可读文字。
3. 后续补 `interactive-page.md` 时，开场页应直接消费这段视频，不再另写一套脱节导语。
