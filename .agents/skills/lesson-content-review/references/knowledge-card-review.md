# 知识卡片审查

最小检查项：
- `sequence.json` 的 `node_ids` / `card_order` 均存在对应卡片
- 卡片 frontmatter 包含 `node_id`、`lesson_units`、`source_docs`
- 卡片正文包含 `## 首页`、`## 详情`
- 首页内容适合快速预习，详情内容支撑课堂与复习
- `asset_refs` 中引用的媒体文件真实存在
- 卡片中的事实、公式、媒体与 handout / boppps / multimedia 保持一致
- 卡片图像必须是真实媒体资源，不使用 ASCII 图

若卡片包含外部事实（人物、任务、新闻、机构、标准、年份、统计数据）：
- 必须联网核验后再保留
- 证据不足时删除或改写为保守说法

若卡片包含可确定计算或控制结论：
- 用 `python3` + `control` 脚本复核对应结论
- 脚本结论与卡片不一致时，以修卡片为先

如果本课复用了 base graph 节点但还没有卡片，应补建 authoring 卡片，再导出 runtime 全局卡片。
