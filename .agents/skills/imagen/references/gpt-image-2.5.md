# GPT Image 2.5：生成与编辑

本项目今后的新图与编辑以 GPT Image 2.5 为目标。历史图片与来源记录保留真实模型，不因升级批量重命名、重新生成或改写。

## 模型选择与实际接口

2026-09-15 核验的官方 API 模型名：

- `gpt-image-2.5-flare`：适合已有质量达标流程的快速生成。
- `gpt-image-2.5-sunburst`：适合复杂信息图、精细文字或多轮编辑中尚未满足的质量要求。

本项目在可选模型的接口中，常规资产先用 Flare；复杂教学信息图可从 Sunburst 开始。是否达标须实际检查，不保证公式或中文零错误，也不把第三方速度宣传作为本项目性能证据。没有未满足的质量问题时不自动增加模型对照、变体或重试。

当前 Codex image_gen 支持 `prompt`、`referenced_image_paths`、`num_last_images_to_include`，不暴露 model/size/quality 字段。接口可能更新，调用以当前 schema 为准。提示词写“2.5”不能切换后端；记录目标模型与实际返回信息，未返回具体模型时标为未披露，不能声称已验证 Flare 或 Sunburst。若实际后端明确是旧型号，不能静默降级；报告限制并使用已授权且可选 2.5 的接口。

官方 API 调用才设置正式 `model`、`quality`、`size` 等参数，使用前确认凭据和当前接口支持。质量档可选 auto/low/medium/high/xhigh/max；不默认追求最高档。16:9 可选 2048x1152，确有更高分辨率需求再评估 3840x2160；超过 2560x1440 总像素的输出在当前官方指南中属实验范围。PNG 不设置 output_compression。

## 精确文字与参考图

- 把应显示的中文、公式、单位和数量明确列出，说明位置及出现次数；不要让模型从长篇说明自行提炼重要数值。
- 每张参考图说明用途：科学几何依据、主题对象、风格或局部编辑底图。风格参考不提供学科事实。
- 公式、箭头、坐标与关系以作者态和科学计算证据为准；模型的世界知识不替代课程真源。

## 局部编辑

先查看原图。明确“改什么”和“保留什么”：布局、曲线形态、比例、标签、公式、颜色和其他已批准内容。一次修正一个有意义的问题，以前次输出为下一轮输入。

本地原图使用 `referenced_image_paths`；只有目标图缺少本地路径时，使用能覆盖目标的最小 `num_last_images_to_include`。两者不同时传入。局部编辑后仍检查整图，特别是未要求改动的公式和标注。

保存候选图、精确编辑提示词和输入图路径，保留原图；只有通过视觉与学科检查才接受。要求像素完全不变时，不能仅靠提示词承诺达成；明确需求并遵循可用工具约束。本项目不因编辑失败改用程序绘制最终信息图。

## 依据

- [官方 GPT Image 2.5 提示词指南](https://developers.openai.com/api/docs/guides/image-prompting)
- [Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare)、[Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst)

上述建议尚未通过本项目 2.5 实际出图对照；此次更新不执行付费生成。
