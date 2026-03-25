# 预置教案知识卡片补充

## Goal
- 分析全部预置教案并在参与式环节嵌入知识卡片，扩充 /knowledge 图谱节点与关系，确保教案可克隆落库。

## Scope
- In-scope: 预置教案项增加知识卡片、克隆逻辑支持 KNOWLEDGE_NODE、知识图谱节点/关系扩充、知识卡片 MDX 与文档更新。
- Out-of-scope: 新增教学资源播放入口、重构知识图谱前端布局。

## Steps
1) 调研现有预置教案与知识图谱/渲染链路，确定需要补充的知识卡片与知识节点。
2) 扩展教案/克隆类型与展示逻辑，支持知识卡片项。
3) 为各课次补充知识卡片项并调整时长，新增知识节点与关系（含 MDX 内容）。
4) 更新文档与脚本，运行 lint/test/build/test:integration 并验收。

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- 所有预置教案在 PARTICIPATORY 环节补齐知识卡片，克隆后落库为 KNOWLEDGE_NODE。
- /knowledge 图谱新增对应节点与关系，知识卡片内容可展示。
- 相关测试通过。
