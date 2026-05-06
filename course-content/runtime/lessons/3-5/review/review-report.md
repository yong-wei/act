# 3-5 课程审查报告

## 审查范围
- 课型：理论
- `course-content/authoring/lessons/3-5/design/3-5-handout.md`
- `course-content/authoring/lessons/3-5/design/3-5-interactive-page.md`
- `course-content/authoring/lessons/3-5/design/3-5-boppps.md`

## 文本技术审查
- 未发现阻塞导出的公式配对问题。

## BOPPPS 对照
- 已将 `design/3-5-boppps.md` 作为 runtime/review 产物导出，供课程制作技能直接读取。

## 互动页覆盖审查
- 已检测到 `3-5` 的 V2 互动契约，步骤字段完整。
- 以下 handout_anchor 未在讲义标题中命中：### 1.1 从 3-4 的结论继续往前走, ### 1.5 [AI融入点] 先写下你的直觉, ### 2.2 例 2：三阶纯极点对象，零点位置不同，主导分支被拉走的方式也不同, ### 3.1` 与 `### 3.2 不先看名字，先看等效阻尼相同的后果, ### 3.2, ### 3.3, ### 3.4, ### 4.2 超前为什么更像在关键位置补角, ### 4.3 频域下的一般设计原则, ### 4.4 频域设计下的适用规律, ### 5.2 非最小相最先暴露出来的，不是慢，而是先往反方向动, ### 5.4 如何控制不能只说原则，先看一个保守带宽实例, 附录A
- 步骤 `step-11` 的“静态承载内容”未显式覆盖公式型映射：G_{\text{lead}}(s)=\frac{Ts+1}{\alphaTs+1},\0<\alpha<1
- 缺少 互动设计接受文件：course-content/authoring/lessons/3-5/design/3-5-interactive-design-acceptance.json

## knowledge-card-check
- 知识卡片已全部存在，且均包含 `## 首页` / `## 详情` 基本结构。

## infograph-check
- 已接受 5 张知识点信息图。
- 尚缺信息图：根轨迹法_2_e3f6c0c1, 根轨迹绘制规则_3_2f9e8cb3, 闭环极点_3_f9432bf3, 零点引入与根轨迹重排_3_35001, 阻尼比_3_b849784e, 自然频率_10_51a8b7d0, PD与测速反馈的等效阻尼对比_3_35003, PD与超前的频域整形差异_3_35004

## multimedia-check
- 已识别并确认存在 2 项正式媒体，未发现缺失。

## 导出结论
- authoring 已作为审查源保留；runtime 已输出 handout、media、review 索引，可直接供后续互动课程制作使用。
