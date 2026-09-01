<!-- openspec-buddy change_id: retire-client-authored-companion-interventions -->

## Goal

关闭控制工作台仍可用客户端手填参数、指标和成功状态创建受治理控灵干预的旧通道，使正式 `ArenaSubmission` 成为调参陪伴的唯一尝试、去重和验证依据。

## Scope

- 移除生产控制工作台的旧手填陪伴入口，并拒绝仅凭客户端 `studentState` 创建 Arena 干预、证据、Memory 或冷却状态。
- 保留正式结果建议卡、任务/方法差异化解释和下一次正式提交验证；历史旧记录保留审计但不进入正式轮次。

## Acceptance

- 未正式提交时，手填或预览值不能产生受治理陪伴记录；伪造任务、方法和尝试状态在持久化前失败。
- 正式提交仍能产生唯一建议并由下一份同任务正式提交验证，且通过服务端、组件、桌面端和 320px 浏览器验收。

Proposal: https://github.com/yong-wei/act/tree/integration/openspec/changes/retire-client-authored-companion-interventions
