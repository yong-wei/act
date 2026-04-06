# 单元 3-5 多模态资源设计与采用清单

> **资源总数**：11 项
> **命名前缀**：全部统一使用 `3-5-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/10.1校正_实现控制的手段/extracted.md` | `pptx` | handout §3 / teacher-handout / interactive step-07~10 | 改写吸收 + 结构图参照 | 必融入 | 服务 `PD`、测速反馈的结构、阻尼公式与三域对照，不直接照搬原图 |
| `course-content/resource-library/pptx/22串联校正/extracted.md` | `pptx` | handout §4 / interactive step-11~13 | 改写吸收 | 必融入 | 吸收 `PD` 与超前的频域整形主线，不前置完整设计流程 |
| `course-content/resource-library/pdf/16频率特性_换个角度看控制.md` | `pdf` | handout §5 / teacher-handout / interactive step-14~15 | 改写吸收 | 必融入 | 用于解释非最小相的名称来源、额外相位滞后与保守带宽边界 |
| `course-content/resource-library/tex/Cpt6.md` | `tex` | handout §3 / 结构核验 | 改写吸收 | 必融入 | 只用于测速反馈定义与等效口径校核 |
| 思政案例 | `civics` | 本轮不接入 | 排除 | 排除 | 本课结构密度高，不强行拼接思政材料 |
| 船舶案例 | `ship-case` | 本轮不接入正文 | 仅作灵感 | 可选融入 | 本课聚焦结构与机理，暂不引入额外对象复杂度 |

---

## 2. 资源总表

| 编号 | 文件名 / 标识 | 生成方式 | 引用于 | 优先级 |
|:---:|---------------|----------|--------|:---:|
| 1 | `3-5-cover-comic.png` | 代码直出位图 | `handout.md` 首页 / interactive step-01 | P0 |
| 2 | `3-5-info.png` | 代码直出信息图 | `handout.md` 课末 / interactive step-16 | P0 |
| 3 | `3-5-md-01-pd-rate-structure.png` | TikZ 结构图 | handout §3.1 / teacher-handout / interactive step-07 | P0 |
| 4 | `3-5-rl-01-low-order-zero-compare.png` | Octave + Python | handout §2.1 / interactive step-04 | P0 |
| 5 | `3-5-rl-02-high-order-zero-compare.png` | Octave + Python | handout §2.2 / interactive step-05 | P0 |
| 6 | `3-5-rl-03-pd-rate-compare.png` | Octave + Python | handout §3.2 / teacher-handout / interactive step-09~10 | P0 |
| 7 | `3-5-rl-04-pd-lead-compare.png` | Octave + Python | handout §4.3 / interactive step-13 | P0 |
| 8 | `3-5-rl-05-nmp-compare.png` | Octave + Python | handout §5.2 / interactive step-14~15 | P0 |
| 9 | `3-5-intro-video.mp4` | AI 视频 | 开场导入 / interactive step-01 可选 | P1 |
| 10 | `ic-35-zero-structure-compare` | 前端绘制 | interactive step-09~10 | P1 |
| 11 | `ic-35-nmp-risk-card` | 前端绘制 | interactive step-12~13 | P1 |

---

## 3. 已完成媒体与用途说明

### 3.1 封面图

- **文件**：`media/processed/3-5-cover-comic.png`
- **来源**：`media/raw/generate_static_assets.py`
- **提示词**：`media/raw/3-5-cover-comic-prompt.md`
- **用途**：讲义首页导入，强调“只调增益”与“引入零点”的对照。

### 3.2 课末信息图

- **文件**：`media/processed/3-5-info.png`
- **来源**：`media/raw/generate_static_assets.py`
- **用途**：课末收束，压缩本课判断链与三组核心比较。

### 3.3 结构图

- **文件**：`media/processed/3-5-md-01-pd-rate-structure.png`
- **来源**：`media/raw/3-5-md-01-pd-rate-structure.tex`
- **用途**：区分 `PD` 与测速反馈结构，强调测速反馈保留单位负反馈外环与速度项局部反馈内环。

### 3.4 根轨迹/时域/频域对照图

- **文件**：
  - `3-5-rl-01-low-order-zero-compare.png`
  - `3-5-rl-02-high-order-zero-compare.png`
  - `3-5-rl-03-pd-rate-compare.png`
  - `3-5-rl-04-pd-lead-compare.png`
  - `3-5-rl-05-nmp-compare.png`
- **来源**：
  - `media/raw/generate_plot_data.m`
  - `media/raw/render_figures.py`
- **用途**：分别承载二阶/三阶零点引入、`PD`/测速反馈、`PD`/超前、非最小相边界的实例比较。

---

## 4. 代码直出图规格

### 资源 `3-5-rl-01` | 二阶纯极点系统接入零点

- **内容**：三联图对照纯极点、`z=-2`、`z=-0.5`
- **关键标注**：开环极点、零点、实轴区段与分支终点
- **教学意图**：把“零点重排根轨迹”第一次讲成实例，不讲空概念

### 资源 `3-5-rl-02` | 三阶对象接入零点

- **内容**：比较 `z=-0.4` 与 `z=-2.5` 对主导分支的不同重排
- **关键标注**：主导分支、零点位置、闭环极点可达区域

### 资源 `3-5-rl-03` | `PD` 与测速反馈三域对照

- **内容**：上方左右分别为 `PD` 与测速反馈的真实根轨迹；下方为阶跃与闭环频率特性对比
- **关键标注**：测速反馈无零点；`PD` 有左半平面零点

### 资源 `3-5-rl-04` | `PD` 与超前三域对照

- **内容**：两个根轨迹子图、一个阶跃对比、一个开环幅频/相频对比
- **关键标注**：零点位置相同但超前多一个极点

### 资源 `3-5-rl-05` | 非最小相边界

- **内容**：镜像零点根轨迹、最小相/非最小相阶跃对比、非最小相不同增益实例、开环频率特性对比
- **关键标注**：逆响应、额外相位滞后、保守带宽

---

## 5. 互动前端绘制需求

### `ic-35-zero-structure-compare`

- **引用位置**：`interactive-page.md` step-09 ~ step-10
- **组件类型**：结构对比表单 + 根轨迹/时域/频域切换卡
- **功能**：学生填写“共同点/不同点”，教师端聚合全班答案

### `ic-35-nmp-risk-card`

- **引用位置**：`interactive-page.md` step-12 ~ step-13
- **组件类型**：风险边界卡片
- **功能**：学生写一句“为什么非最小相要先保守带宽”，教师端按关键词聚合

---

## 6. 后续执行建议

1. 互动实现时，优先复用本课已完成的 5 张对照图，不要再用前端重复绘制根轨迹；
2. `PD` 与测速反馈结构图必须直接使用当前 TikZ 成品，不允许重新画成“只有局部比例反馈”的错误形式；
3. 若后续继续做 `teacher-handout.pdf`、课堂课件或导入视频，应统一沿用 `3-5-cover-comic.png` 与 `3-5-info.png` 的配色与标题语言；
4. 若要继续补 `interactive-contract.yaml`，步骤分组应直接对齐 `sequence.json` 的五组主线。
