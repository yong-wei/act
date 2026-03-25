# 预置教案知识点补齐

## Goal
- 补齐预置教案依赖的知识点数据，确保模板克隆成功

## Scope
- In-scope items
  - 补齐/统一知识点种子脚本与启动流程
  - 更新项目说明文档
- Out-of-scope items
  - 预置教案内容调整或新教案设计

## Steps
1) 审核预置教案所需的 knowledgeNodeId 与现有种子脚本覆盖范围
2) 更新种子脚本/启动流程与相关文档，确保启动前补齐知识点
3) 运行 lint/test/build/集成测试并记录结果

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- 预置教案克隆不再因缺失 KnowledgeNode 报错
- 文档明确知识点补齐方式
- 所有指定测试通过
