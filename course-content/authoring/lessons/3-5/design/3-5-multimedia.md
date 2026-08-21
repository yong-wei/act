# 单元 3-5 多模态资源设计与采用清单

> **当前阶段目标**：对齐新版讲义、互动设计与图谱步骤，统一 `3-5` 的媒体采用单、资源总表、代码直出图规格、互动前端绘制需求与课程级媒体链接文档。
> **资源总数**：11 项
> **命名前缀**：全部统一使用 `3-5-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/10.1校正_实现控制的手段/extracted.md` | `pptx` | handout §3 / teacher-handout / interactive step-07~09 | 改写吸收 + 结构图参照 | 必融入 | 只服务 `PD`、测速反馈结构辨认、阻尼公式与三域比较，不照搬页序 |
| `course-content/resource-library/pptx/22串联校正/extracted.md` | `pptx` | handout §4 / teacher-handout / interactive step-10~12 | 改写吸收 | 必融入 | 吸收 `PD` 与超前的频域整形主线，不提前进入完整整定流程 |
| `course-content/resource-library/pdf/16频率特性_换个角度看控制.md` | `pdf` | handout §5 / interactive step-13~14 / multimedia 边界说明 | 改写吸收 | 必融入 | 服务非最小相名称来源、相位滞后与保守带宽边界 |
| `course-content/resource-library/tex/Cpt6.md` | `tex` | handout §3 / teacher-handout / 图谱节点校核 | 改写吸收 | 必融入 | 只用于测速反馈定义、双层结构与等效阻尼口径核验 |
| `course-content/resource-library/civics-cases/cases/03-数理交响启示录.md` | `civics` | 本轮不接入正文 | 仅作灵感 | 排除 | 本课结构密度高，不强行插入价值引导段落 |
| `course-content/resource-library/ship-control-cases/sections/4.1-4.3` | `ship-case` | 本轮不接入正文 | 仅作灵感 | 排除 | 本课聚焦零点机理与边界，不引入额外对象复杂度，工程场景留到 `3-6` 统一实验链再展开 |

## 2. 扫描后资源总表

| 编号 | 文件名 / 标识 | 生成方式 | 引用于 | 优先级 |
| :---: | --- | --- | --- | :---: |
| 1 | `3-5-cover-comic.png` | AI 静态图 | `handout.md` 首页 / interactive `step-01` / teacher-handout 导入 | P0 |
| 2 | `3-5-info.png` | 代码直出信息图 | `handout.md` 课末 / interactive `step-15` / teacher-handout 收束 | P0 |
| 3 | `3-5-md-01-pd-rate-structure.png` | TikZ 线框图 | handout §3.1 / interactive `step-07` / teacher-handout 结构辨认 | P0 |
| 4 | `3-5-rl-01-low-order-zero-compare.png` | `Octave` + `Python/matplotlib` | handout §2.1 / interactive `step-04` / 卡片 `零点引入与根轨迹重排` | P0 |
| 5 | `3-5-rl-02-high-order-zero-compare.png` | `Octave` + `Python/matplotlib` | handout §2.2 / interactive `step-05` / 卡片 `零点引入与根轨迹重排` | P0 |
| 6 | `3-5-rl-03-pd-rate-compare.png` | `Octave` + `Python/matplotlib` | handout §3.2 / interactive `step-09` / teacher-handout / 卡片 `PD与测速反馈的等效阻尼对比` | P0 |
| 7 | `3-5-rl-04-pd-lead-compare.png` | `Octave` + `Python/matplotlib` | handout §4 / interactive `step-10`~`step-12` / 卡片 `PD与超前的频域整形差异` | P0 |
| 8 | `3-5-rl-05-nmp-compare.png` | `Octave` + `Python/matplotlib` | handout §5 / interactive `step-13`~`step-14` / 卡片 `非最小相与右半平面零点` | P0 |
| 9 | `3-5-intro-video.mp4` | AI 视频 | 课程导入 / interactive `step-01` | P1 |
| 10 | `ic-35-tri-domain-compare-panel` | 前端绘制 | interactive `step-09` 三域填写区 | P1 |
| 11 | `ic-35-boundary-rule-check` | 前端绘制 | interactive `step-14` 规则判断区 | P1 |

## 3. 已有媒体与用途对齐

### 3.1 封面图

- **文件**：`media/processed/3-5-cover-comic.png`
- **提示词**：`media/raw/3-5-cover-comic-prompt.md`
- **用途**：导入“只调增益为什么不够”与“零点改变结构”的第一冲突。

### 3.2 课末信息图

- **文件**：`media/processed/3-5-info.png`
- **用途**：压缩本课四个观察量与三组核心对照，直接服务 `step-15` 的课末收束。

### 3.3 结构图

- **文件**：`media/processed/3-5-md-01-pd-rate-structure.png`
- **来源**：`media/raw/3-5-md-01-pd-rate-structure.tex`
- **用途**：区分 `PD` 与测速反馈的前向零点与局部速度反馈结构。

### 3.4 代码直出图

- **文件**：
  - `3-5-rl-01-low-order-zero-compare.png`
  - `3-5-rl-02-high-order-zero-compare.png`
  - `3-5-rl-03-pd-rate-compare.png`
  - `3-5-rl-04-pd-lead-compare.png`
  - `3-5-rl-05-nmp-compare.png`
- **来源**：
  - `media/raw/generate_plot_data.m`
  - `media/raw/render_figures.py`
- **用途**：分别承载左半平面零点重排、`PD / 测速反馈` 三域对照、`PD / 超前` 频域差异、非最小相边界。

## 4. 代码直出图规格

### `3-5-rl-01-low-order-zero-compare.png`

- **内容**：纯极点基准、`z=-2`、`z=-0.5` 三版本对照
- **关键标注**：开环极点、零点、实轴区段、分支终点
- **教学作用**：把“零点重排根轨迹”第一次讲成实例，不停留在空概念

### `3-5-rl-02-high-order-zero-compare.png`

- **内容**：三阶对象在 `z=-0.4` 与 `z=-2.5` 两种位置下的根轨迹重排
- **关键标注**：主导分支、零点位置、闭环极点可达区域
- **教学作用**：说明零点位置不同，主导分支被拉走的方式也不同

### `3-5-rl-03-pd-rate-compare.png`

- **内容**：`PD` 与测速反馈的根轨迹、阶跃响应、闭环频率特性三域对照
- **关键标注**：同样增阻尼、不同结构来源、测速反馈无前向零点
- **教学作用**：支持 `step-09` 的三域结构化填写

### `3-5-rl-04-pd-lead-compare.png`

- **内容**：`PD` 与超前的根轨迹、时域和开环幅相特性对照
- **关键标注**：`PD` 持续抬中高频、超前在关键频带制造相位峰
- **教学作用**：支持 `step-10` ~ `step-12` 的频带与场景判断

### `3-5-rl-05-nmp-compare.png`

- **内容**：镜像零点对象、最小相 / 非最小相阶跃响应、频域后果对照
- **关键标注**：逆响应、额外相位滞后、保守带宽
- **教学作用**：支撑 `step-13`、`step-14` 的边界判断

## 5. 互动前端绘制需求

### `ic-35-tri-domain-compare-panel`

- **引用位置**：`interactive-page.md` `step-09`
- **组件类型**：三域填写面板
- **功能要求**：按根轨迹、时域、频域三栏收集共同点与不同点；教师端聚合全班漏填域分布

### `ic-35-boundary-rule-check`

- **引用位置**：`interactive-page.md` `step-14`
- **组件类型**：规则判断区
- **功能要求**：判断规则陈述是否同时包含“结论 + 原因”，教师端聚合缺失项标签

## 6. 卡片复用与 sequence 对齐

- `零点引入与根轨迹重排_3_35001` 复用 `3-5-rl-01`、`3-5-rl-02`
- `PD与测速反馈的等效阻尼对比_3_35003` 复用 `3-5-rl-03`
- `PD与超前的频域整形差异_3_35004` 复用 `3-5-rl-04`
- `非最小相与右半平面零点_3_35005` 复用 `3-5-rl-05`

sequence 分组需要与新版 15 步互动设计保持一致，不再引用旧的 `step-16`。

## 7. 后续执行建议

1. 互动实现阶段优先复用现有 5 张代码直出图，不再在前端重复计算根轨迹与闭环频率特性。
2. `PD` 与测速反馈结构图必须直接使用当前 TikZ 成品，不允许重新画成“只有一个局部比例反馈块”的错误形式。
3. `3-5-media.md` 只保留 5 个课程级资源条目，并只填写导入视频的一句内容文案，其他说明与链接留给用户手工补充。
## 课程导入视频

- 成品：`media/processed/3-5-intro-video.mp4`（已完成）
- 用途：课程导入 / interactive `step-01`。
