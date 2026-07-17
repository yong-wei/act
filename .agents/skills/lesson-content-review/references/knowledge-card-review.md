# 知识卡片审查

最小检查项：
- `sequence.json` 的 `node_ids` / `card_order` 均存在对应卡片
- 卡片 frontmatter 包含 `node_id`、`lesson_units`、`source_docs`
- 卡片正文包含 `## 首页`、`## 详情`
- 首页内容适合快速预习，详情内容支撑课堂与复习
- `asset_refs` 中引用的媒体文件真实存在
- 卡片中的事实、公式、媒体与 handout / boppps / multimedia 保持一致
- 卡片图像必须是真实媒体资源，不使用 ASCII 图
- `sequence.json` 的每个分组在 runtime 中按 `step_ids` 集合 × `node_ids` 集合映射；同一 step 跨组出现时，后写分组会覆盖先写分组，因此每个 step 只能归入一个分组，并需逐卡对照互动页确认实际归属
- 复用卡必须把当前课次补入 `lesson_units`，并把当前课 handout 补入 `source_docs`，不能只保留最初创建课次
- 正文图片必须使用最终页面可消费的 URL；authoring 相对文件路径若不会被 runtime/MDX 消费，应改为已验证有效的绝对 runtime URL

若卡片包含外部事实（人物、任务、新闻、机构、标准、年份、统计数据）：
- 必须联网核验后再保留
- 证据不足时删除或改写为保守说法

若卡片包含可确定计算或控制结论：
- 用 `python3` + `control` 脚本复核对应结论
- 脚本结论与卡片不一致时，以修卡片为先

如果本课复用了 base graph 节点但还没有卡片，应补建 authoring 卡片，再导出 runtime 全局卡片。
