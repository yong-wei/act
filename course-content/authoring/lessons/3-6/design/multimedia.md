# 单元 3-6 多模态资源设计与采用清单

> **资源总数**：13 项
> **命名前缀**：全部统一使用 `3-6-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/10.1校正_实现控制的手段/extracted.md` | `pptx` | handout §4 / teacher-handout / interactive step-08 | 改写吸收 + 结构图参照 | 必融入 | 重点吸收测速反馈的标准表达式和“提高阻尼但不显式增零点”的口径 |
| `course-content/resource-library/pptx/22串联校正/extracted.md` | `pptx` | handout §5 / teacher-handout / interactive step-09 | 改写吸收 | 必融入 | 重点吸收“先由频域目标反推补角和截止频率，再求超前参数”的设计流程 |
| `course-content/resource-library/pptx/14参数根轨迹_广义定义/extracted.md` | `pptx` | handout §4 / teacher-handout / interactive step-08 | 改写吸收 | 必融入 | 只服务测速反馈的广义根轨迹等效，不重讲一般参数根轨迹法则 |
| `course-content/resource-library/pptx/12根轨迹_基本形态/extracted.md` | `pptx` | handout §3 / interactive step-07 | 改写吸收 + 图示骨架复用 | 必融入 | 只服务“根轨迹如何进入设计可行域”的表达，不重讲法则本身 |
| `course-content/questions/questions/AC-Q-0044.md` | `exercise` | handout §3-4 / post-assessment | 仅作灵感 | 可选融入 | 只取 `PD` 与测速反馈设计口径对比，不直接复用题面 |
| `course-content/questions/questions/AC-Q-0075.md` | `exercise` | handout §7 / 边界追问 | 仅作灵感 | 可选融入 | 只取“零点改变策略边界”的表达，不直接复用题面 |
| 思政案例 | `civics` | 本轮不接入 | 排除 | 排除 | 本课主线是目标驱动设计，不强行拼接思政材料 |
| 船舶案例 | `ship-case` | 本轮不接入正文 | 排除 | 排除 | 当前目标是让学生在单对象上形成设计动作，不增加场景噪声 |

---

## 2. 资源总表

| 编号 | 文件名 / 标识 | 生成方式 | 引用于 | 优先级 |
| :---: | --- | --- | --- | :---: |
| 1 | `3-6-cover-comic.png` | AI 静态图 | `handout.md` 首页 / interactive step-01 | P0 |
| 2 | `3-6-info.png` | 代码直出信息图 | `handout.md` 课末 / interactive step-13 | P1 |
| 3 | `3-6-design-map.png` | 代码直出信息图 | handout §2 / interactive step-05 | P1 |
| 4 | `3-6-pd-design.png` | Octave + Python | handout §3 / interactive step-07 | P0 |
| 5 | `3-6-rate-feedback-design.png` | Octave + Python | handout §4 / interactive step-08 | P0 |
| 6 | `3-6-pd-rate-structure.png` | 复用 `3-5` 结构图 | handout §4 / teacher-handout / interactive step-08 | P1 |
| 7 | `3-6-lead-design.png` | Octave + Python | handout §5 / interactive step-09 | P0 |
| 8 | `3-6-pd-frequency-design.png` | Octave + Python | handout §6 / interactive step-10 | P0 |
| 9 | `3-6-rhp-boundary.png` | Octave + Python | handout §7 / interactive step-11 | P0 |
| 10 | `3-6-intro-video.mp4` | AI 视频 | Bridge-in / interactive step-01 | P1 |
| 11 | `3-6-intro-video-prompts.md` | 提示词文稿 | 视频生成依据 | 已有 |
| 12 | `3-6-cover-comic-prompt.md` | 提示词文稿 | 封面漫画生成依据 | P1 |
| 13 | `ic-36-design-report` | 前端绘制 | interactive step-11~13 | P1 |

---

## 3. 核心图示规格

### 3.1 `3-6-pd-design.png`

- **内容**：纯增益根轨迹与 `PD` 补偿后根轨迹对照、设计可行域、目标点、阶跃响应与计算摘要
- **关键标注**：
  - 纯增益根轨迹实部恒为 `-0.4`
  - 阻尼比线
  - 调节时间线
  - 目标设计点 $s_d=-1.1\pm j1.67$
  - 零点位置 $z_c=2.857$
  - 角度标注 $\theta_1,\theta_2,\theta_z$
  - 最终参数 $T_d=0.35,\ K=1$

### 3.2 `3-6-rate-feedback-design.png`

- **内容**：原比例根轨迹与测速反馈广义根轨迹等效后的对照、等效极点后移、阶跃响应与计算摘要
- **关键标注**：
  - $U(s)=K E(s)-K_t sY(s)$
  - $1+\dfrac{4K}{s(s+0.8+4K_t)}=0$
  - 极点从 $-0.8$ 等效后移到 $-2.2$
  - 最终参数 $K_t=0.35,\ K=1$

### 3.3 `3-6-lead-design.png`

- **内容**：同样把交叉频率推到 `3 rad/s` 时，纯增益方案与超前方案的 `Bode` 图和阶跃响应对照
- **关键标注**：
  - 基准增益方案只有 `PM≈14.93°`
  - 目标频域指标：`PM≥50°`、`\omega_c≈3`
  - 设计结果：$\psi_m\approx 43.07^\circ$、$a\approx 5.307$、$T\approx 0.145$、$K_c\approx 1.011$
  - 补偿后 `PM≈58°`

### 3.4 `3-6-pd-frequency-design.png`

- **内容**：在与任务 C 完全相同的频域指标下，纯增益方案与 `PD` 方案的 `Bode` 图和阶跃响应对照
- **关键标注**：
  - 同一目标：`PM≥50°`、`\omega_c≈3`
  - `PD` 相角需求：$\phi_d\approx 35.07^\circ$
  - 最终参数：$T_d\approx 0.234$、$K\approx 1.906$
  - 与超前相比的时域副作用提示

### 3.5 `3-6-rhp-boundary.png`

- **内容**：右半平面零点下的相位损失、带宽上限与三种保守结构选择示例
- **关键标注**：
  - 非最小相对象相位曲线与原纯极点对象对照
  - 推荐带宽上限约为 $\omega_z/3$
  - 若强行取 `\omega_c≈3`，则 `PM<0`
  - 三种保守示例的响应对照与结构选择结论

### 3.6 `3-6-pd-rate-structure.png`

- **内容**：`PD` 与测速反馈的结构对比图
- **来源**：复用 `3-5` 结构图版式并转存为 `3-6` 前缀资源
- **教学意图**：在进入广义根轨迹等效前，先把“前向显式零点”和“局部速度反馈”区分清楚

---

## 4. 互动前端绘制需求

### `ic-36-design-report`

- **引用位置**：`interactive-page.md` step-11 ~ step-13
- **组件类型**：设计报告汇总面板
- **功能**：
  - 汇总任务 A / B / C / D 的目标、参数、验收结果
  - 单独显示任务 E 的边界判断与最终结构选择
  - 教师端聚合全班“达标路径”“失效目标”和“结构选择理由”

---

## 5. 后续执行建议

1. 互动实现时，必须让任务 C 与任务 D 共用同一组频域目标，避免把比较做成两套不同指标下的伪对比。
2. 任务 E 不应开放激进带宽自由调参，应把重点放在“先重审目标、再选结构”的判断链上。
3. 若后续补 `interactive-contract.yaml`，契约应直接对齐“指标翻译 -> A/B/C/D/E 五任务链 -> 设计报告”的结构。
