## ADDED Requirements

### Requirement: 仿真与 Arena 证据携带任务级来源语义
受治理的 Simulation、Arena、控制工作台和奥德赛证据 SHALL 携带稳定任务标识、带学生归属命名空间的产物标识、来源层级和可复核摘要，并由同一规范化产物身份约束实时写入和历史物化。ArenaEvaluationRun 只能作为已接受 ArenaSubmission 的关联评测证据，不能独立形成学生任务完成。

#### Scenario: 同一 Arena 产物跨入口到达
- **WHEN** 一个 Arena 产物通过工作台事件、正式评测或历史物化被重复处理
- **THEN** 系统将它归入同一稳定任务和产物身份
- **AND** 只保留最高证据层级
- **AND** 不创建重复的任务级贡献

#### Scenario: 未绑定提交的 Arena 评测不形成完成证据
- **WHEN** ArenaEvaluationRun 没有唯一关联到学生归属已确认且被接受的 ArenaSubmission
- **THEN** 系统不得将该评测表示为学生任务完成
- **AND** 历史物化记录明确跳过原因

#### Scenario: 教师预览不产生学生任务证据
- **WHEN** 教师或管理员预览仿真、Arena 或控制工作台
- **THEN** 系统不得将该操作物化为学生任务证据
- **AND** 预览记录不得改变任何学生的仿真任务状态
