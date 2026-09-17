---
name: openspec-apply-change
description: 根据已有 OpenSpec 变更实施任务并完成相关验证。
license: MIT
metadata:
  author: openspec
  upstreamVersion: "1.13.0"
  compatibility: "OpenSpec CLI 1.13.0; project adaptation"
---

# openspec-apply-change

以当前 change 工件和 CLI 状态为准。普通实现失败在授权范围内修复；真正缺少工件、产品决策或权限时仅暂停相关动作。验证满足验收后标记任务完成，不因每一项任务切换重复测试。

先从用户指令和会话确定目标 change，只有多个候选无法消歧时才提问。普通可逆选择自主完成，明确要求只审查时不写文件。用户当前明确指令优先于技能建议，项目安全与数据边界继续生效。

实际操作读取 [工作流与 CLI 合同](references/workflow.md)，保留其中路径、schema、状态与数据完整性规则。只加载所选工作流；不自动串行执行其他技能或调用子代理。

本项目已核实全局 CLI 为 1.6.0，不支持这些新模板的完整返回合同。示例使用固定版本 `rtk proxy npx --yes --package @fission-ai/openspec@1.13.0 openspec`，不修改全局 CLI。首次运行会安装到 npm 缓存；获取失败时报告阻塞，不用旧 CLI 猜测缺失路径或字段。

只执行当前任务所需的状态读取与验证，复用未变化的 CLI 结果。完成后说明工件与验证结果，不输出固定祝贺、逐步骤广播或无关后续建议。
