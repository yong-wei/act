# 单元 3-6 多模态资源设计与采用清单

> **资源总数**：10 项
> **命名前缀**：全部统一使用 `3-6-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/12根轨迹_基本形态/extracted.md` | `pptx` | handout §4 / interactive step-07 | 改写吸收 + 图示骨架复用 | 必融入 | 只服务“零点引入后根轨迹骨架变化”的全局比较，不重讲根轨迹法则 |
| `course-content/resource-library/pptx/10.1校正_实现控制的手段/extracted.md` | `pptx` | handout §5 / teacher-handout / interactive step-08 | 改写吸收 + 结构图参照 | 必融入 | 重点吸收 `PD` 与测速反馈结构差异，不扩写前馈补偿和扰动补偿 |
| `course-content/resource-library/pptx/22串联校正/extracted.md` | `pptx` | handout §5 / interactive step-08 | 改写吸收 | 必融入 | 只吸收简单超前的频带整形口径，不提前进入完整超前设计流程 |
| `course-content/resource-library/pptx/15.1根轨迹法_图形化思考/README.md` | `pptx` | interactive step-07~08 | 仅作灵感 | 可选融入 | 只借“图上先看趋势再补理由”的实践语感 |
| `course-content/questions/questions/AC-Q-0044.md` | `exercise` | handout 例题 2 / post-assessment | 改写吸收 | 可选融入 | 只吸收 `PD` 与测速反馈对照口径 |
| `course-content/questions/questions/AC-Q-0075.md` | `exercise` | teacher-handout / 板书扩展 | 仅作灵感 | 可选融入 | 只吸收“零点改变轨迹”的代表性结论 |
| 思政案例 | `civics` | 本轮不接入 | 排除 | 排除 | 本课核心负载是统一对象四版本比较，不强行拼接 |
| 船舶案例 | `ship-case` | 本轮不接入 | 排除 | 排除 | 船舶对象会增加场景噪声，不利于压实结构比较 |

---

## 2. 资源总表

| 编号 | 文件名 / 标识 | 生成方式 | 引用于 | 优先级 |
| :---: | --- | --- | --- | :---: |
| 1 | `3-6-cover-comic.png` | AI 静态图 | `handout.md` 首页 / interactive step-01 | P0 |
| 2 | `3-6-info.png` | 代码直出信息图 | `handout.md` 课末 / interactive step-12 | P0 |
| 3 | `3-6-compare-overview.png` | Octave + Python | handout §2 / teacher-handout / interactive step-05 | P0 |
| 4 | `3-6-structure-compare.png` | TikZ 结构图 | handout §5 / teacher-handout / interactive step-08 | P0 |
| 5 | `3-6-rhp-risk.png` | Octave + Python | handout §6 / teacher-handout / interactive step-09 | P0 |
| 6 | `3-6-intro-video.mp4` | AI 视频 | Bridge-in / interactive step-01 | P1 |
| 7 | `3-6-intro-video-prompts.md` | 提示词文稿 | 视频生成依据 | 已有 |
| 8 | `3-6-cover-comic-prompt.md` | 提示词文稿 | 封面漫画生成依据 | P1 |
| 9 | `ic-36-compare-matrix` | 前端绘制 | interactive step-08~10 | P1 |
| 10 | `ic-36-risk-card` | 前端绘制 | interactive step-09~10 | P1 |

---

## 3. 已有与待生成文稿

### 3.1 已有导入视频提示词

- **文件**：`media/raw/3-6-intro-video-prompts.md`
- **用途**：用于生成“多工位对照实验型”导入短视频
- **画面主轴**：四工位并排比较 + 一个风险演示工位

### 3.2 本轮新增封面漫画提示词

- **文件**：`media/raw/3-6-cover-comic-prompt.md`
- **用途**：生成讲义首页封面漫画
- **画面主轴**：同一实验台上四版本并排，对照“看起来相似、结果却分叉”

---

## 4. 代码直出图规格

### 资源 `3-6-compare-overview`

- **内容**：基准、`PD`、测速反馈、简单超前四版本的统一比较总览
- **图内组织**：上排根轨迹，中排阶跃响应，下排 `Bode` 趋势
- **教学意图**：让学生先建立“四版本必须同坐标比较”的整体印象

### 资源 `3-6-structure-compare`

- **内容**：`PD`、测速反馈、简单超前的结构差异图
- **关键标注**：
  - `PD` 前向通道显式零点
  - 测速反馈的速度项回授
  - 简单超前的零点 + 极点
- **教学意图**：阻止学生把三者混写成同一个结构

### 资源 `3-6-rhp-risk`

- **内容**：左半平面零点与右半平面零点的趋势对照
- **关键标注**：初始趋势、相位变化、风险提示
- **教学意图**：把右半平面零点压缩成边界提醒

---

## 5. 互动前端绘制需求

### `ic-36-compare-matrix`

- **引用位置**：`interactive-page.md` step-08 ~ step-10
- **组件类型**：统一对照表填写区
- **功能**：
  - 四版本并排列
  - 自动保存已填内容
  - 教师端聚合关键词

### `ic-36-risk-card`

- **引用位置**：`interactive-page.md` step-09
- **组件类型**：风险记录卡
- **功能**：
  - 固定三项观察任务
  - 学生只写现象与意义
  - 教师端聚合错误直觉

---

## 6. 后续执行建议

1. 互动实现时优先消费 `3-6-compare-overview.png`、`3-6-structure-compare.png` 和 `3-6-rhp-risk.png`，不要在前端重复绘制根轨迹。
2. 教师演示区必须锁定右半平面零点版本，避免学生把课堂主线带偏成自由尝试异常版本。
3. 若后续继续补 `interactive-contract.yaml`，步骤分组应直接对齐 `预测 -> 验证 A -> 验证 B -> 风险观察 -> 修正收束` 五段。
