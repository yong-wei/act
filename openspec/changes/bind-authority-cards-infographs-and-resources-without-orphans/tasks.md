## 1. 统一 Teaching 身份

- [ ] 1.1 让 node-detail 卡/资源读取使用 shard envelope 的 teaching overlay 身份，不再拿另一份 `projection/current.json` 的 projectionId 做全员 mismatch
- [ ] 1.2 把课程投影 artifacts 重发布或挂到同一 projectionId/hash，或降为该信封 sidecar
- [ ] 1.3 测试：信封与课程 pointer 不一致时，语义详情仍可用，且不再对每个节点显示身份不一致

## 2. 卡与信息图全量链接

- [ ] 2.1 导出 v2 learning-content manifest，枚举全部 Authority 卡文件和信息图文件
- [ ] 2.2 按 `authority_entity_id` 精确绑定当前图谱 object id；拒绝中文名模糊匹配
- [ ] 2.3 合格卡在对应抽屉渲染；draft-blocked 入账本但不展示为已审
- [ ] 2.4 任一卡或信息图未链接则脚本非零退出

## 3. 系统资源无孤儿

- [ ] 3.1 审计 `resources.jsonl`：每条必须有指向现存节点的 binding
- [ ] 3.2 补齐人类可读 title；空 title 不得投影为 available
- [ ] 3.3 为可启动类型提供安全 href/launcher；验证传递函数、根轨迹、稳定性等典型节点抽屉出现绑定
- [ ] 3.4 全量门禁：孤儿资源、空 title、未链接卡/图任一失败即阻断

## 4. 验证

- [ ] 4.1 用用户可点的典型节点做抽屉验收：传递函数、伯德图、串联超前校正、主导极点、稳态跟踪误差、K_H*
- [ ] 4.2 跑 `openspec validate bind-authority-cards-infographs-and-resources-without-orphans --type change --strict` 与聚焦测试
