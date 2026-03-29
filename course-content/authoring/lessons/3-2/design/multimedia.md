# 多模态资源设计 | 单元 3-2：劳斯判据——从高阶系统稳定判定到参数可行域

> **资源总数**：10 项正式媒体规划，其中 4 项已完成、6 项待补齐。
> **当前完成**：`3-2-pole-migration.png`、`3-2-step-comparison.png`、`3-2-bode-magnitude.png`、`3-2-slides-source.m` 对应图像脚本。
> **本轮重点**：以统一高阶主对象支撑讲义、教师版讲义和互动页，不再新增同义图，避免图像口径分叉。
> **验证约定**：本单元所有控制图统一以 `Octave + control` 为真值来源。

---

## 1. 本课资源采用单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
|---|---|---|---|---|---|
| `course-content/resource-library/pptx/8稳定_控制系统首要任务/README.md` | `pptx` | 讲义正文 / 课堂导入 / 特殊情况方法卡 | 改写吸收 | 必融入 | 吸收劳斯骨架、特殊情况处理与参数区间主线，不照搬旧例题串讲 |
| `course-content/questions/questions/AC-Q-0048.md` | `exercise` | 图 1-3 数值核验思路 | 改写吸收 | 必融入 | 服务参数扫描、典型响应和趋势验证 |
| `course-content/questions/questions/AC-Q-0046.md` | `exercise` | 特殊情况辨识 | 改写吸收 | 必融入 | 服务 `首位为0` 与 `全零行` 的方法辨识 |
| `course-content/resource-library/civics-cases/cases/03-数理交响启示录.md` | `civics` | 附录 A | 改写吸收 + 直接复用配图 | 可选融入 | 服务“数学融入工程”的科学史收束 |
| `course-content/resource-library/pptx/11放眼大局_根轨迹法/README.md` 等根轨迹资源 | `pptx` | 无 | 排除 | 排除 | 避免本课提前进入根轨迹法则系统教学 |

---

## 2. 正式命名与目录约束

- 所有正式媒体固定使用 `3-2-...` 前缀。
- 原料目录：`media/raw/`
- 成品目录：`media/processed/`
- 当前已有脚本：
  - `media/raw/3-2-generate-plots.m`
- 当前已有成品：
  - `media/processed/3-2-pole-migration.png`
  - `media/processed/3-2-step-comparison.png`
  - `media/processed/3-2-bode-magnitude.png`

---

## 3. 资源总表

| 编号 | 文件名 | 类型 | 状态 | 引用于 |
|:---:|---|---|:---:|---|
| 1 | `3-2-pole-migration.png` | 代码直出图 | 已完成 | `handout` §3、§6 / `boppps` 导入 / `interactive-page` 步骤 2、7 |
| 2 | `3-2-step-comparison.png` | 代码直出图 | 已完成 | `handout` §5 / `boppps` 三域对应段 / `interactive-page` 步骤 10 |
| 3 | `3-2-bode-magnitude.png` | 代码直出图 | 已完成 | `handout` §5 / `boppps` 三域对应段 / `interactive-page` 步骤 11 |
| 4 | `3-2-special-cases-card.png` | 方法卡 | 待制作 | `interactive-page` 步骤 8、9 / `boppps` 特殊情况段 |
| 5 | `3-2-parameter-range-flow.png` | 流程图 | 待制作 | `handout` §6 / `interactive-page` 步骤 12 |
| 6 | `3-2-cover-comic.png` | 讲义封面图 | 待制作 | 讲义封面 / 互动课入口 |
| 7 | `3-2-info.png` | 讲义信息图 | 待制作 | 讲义总结 / 互动课收束页 |
| 8 | `3-2-slides.pdf` | 生成式课件 | 待制作 | 课堂投屏 / 课件归档 |
| 9 | `3-2-intro-video.mp4` | 导入视频 | 待制作 | 课堂开场 / 互动课首页 |
| 10 | `3-2-audio.m4a` | 音频播客 | 待制作 | 音频归档 |

---

## 4. 现有代码直出图与原料映射

| 标识 | 原料文件 | 成品文件 | 工具 | 核心用途 |
|---|---|---|---|---|
| `pp-01` | `media/raw/3-2-generate-plots.m` | `media/processed/3-2-pole-migration.png` | Octave | 展示统一对象在参数扫描下的极点迁移范围，支撑稳定区间和区域约束的几何解释 |
| `pp-02` | `media/raw/3-2-generate-plots.m` | `media/processed/3-2-step-comparison.png` | Octave | 展示稳定、临界、失稳三种状态在时间响应中的差异 |
| `pp-03` | `media/raw/3-2-generate-plots.m` | `media/processed/3-2-bode-magnitude.png` | Octave | 展示接近稳定边界时频域峰值抬高的趋势 |

说明：

- `pp-01` 是本课最关键的主图，用于连接代数区间、极点结构和区域约束。
- `pp-02` 与 `pp-03` 共同承担“三域对应”中的时域和频域证据。
- 三张图已经在讲义正文中完成回写，后续应直接复用到教师版讲义和互动页，不再生成同义版。

---

## 5. 后续待制作媒体建议

### 5.1 特殊情况方法卡

- 正式文件名：`3-2-special-cases-card.png`
- 推荐内容：
  - 左卡：`首位为0，非全零行` 的处理流程
  - 右卡：`全零行` 的辅助方程流程
- 用途：互动页步骤 8-9 的固定说明板

### 5.2 参数可行域流程图

- 正式文件名：`3-2-parameter-range-flow.png`
- 推荐内容：
  - 写特征方程
  - 列带参数劳斯表
  - 取第一列条件
  - 合并区间
  - 若有区域约束则先做变量平移

### 5.3 课程级资源

| 资源 | 正式文件名 | 当前说明 |
|---|---|---|
| 封面图 | `3-2-cover-comic.png` | 建议围绕“高阶方程、虚轴边界、参数滑块”构图 |
| 信息图 | `3-2-info.png` | 总结“普通判稳、特殊情况、三域对应、区域约束”四条主线 |
| 课件 | `3-2-slides.pdf` | 待按 handout / teacher-handout 统一口径生成 |
| 导入视频 | `3-2-intro-video.mp4` | 待围绕“参数推到边界会发生什么”制作 |
| 音频播客 | `3-2-audio.m4a` | 待课程脚本稳定后再做 |

---

## 6. 复用策略

- `3-2-pole-migration.png` 在正文、教师讲义和互动页都应保持同一图号和同一图意。
- `3-2-step-comparison.png` 与 `3-2-bode-magnitude.png` 必须成对使用，避免三域链条被拆散。
- 附录 A 使用课程思政案例的人物配图，不再单独复制到本单元 `media/processed/`，避免资产重复。

---

## 7. 后续制作优先级

### P1：已完成，可直接复用

- `3-2-pole-migration.png`
- `3-2-step-comparison.png`
- `3-2-bode-magnitude.png`
- `3-2-generate-plots.m`

### P2：建议尽快补齐

- `3-2-special-cases-card.png`
- `3-2-parameter-range-flow.png`
- `3-2-slides.pdf`

### P3：课程脚本稳定后再做

- `3-2-cover-comic.png`
- `3-2-info.png`
- `3-2-intro-video.mp4`
- `3-2-audio.m4a`
