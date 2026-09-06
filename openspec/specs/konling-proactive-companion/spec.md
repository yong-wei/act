# konling-proactive-companion Specification

## Purpose
TBD - created by archiving change issue-1966. Update Purpose after archive.
## Requirements
### Requirement: 陪伴信号采集与页面类型上报

全局 Provider SHALL 采集页面可见性、窗口焦点、最近有效学习操作与媒体状态；资源/教材页与自适应练习页 SHALL 通过类型化 Hook 上报题目、互动步骤、资源标识与播放状态。信号采集 SHALL NOT 记录逐秒观看、完整拖动或音量轨迹。

#### Scenario: 页面上报互动步骤
- **WHEN** 学生在接入页面完成一次有效学习操作
- **THEN** Hook 以类型化事件上报页面类型、页面标识与操作摘要，供服务端证据加权使用

#### Scenario: 媒体状态仅上报粗粒度状态
- **WHEN** 学生播放或暂停会话外页面媒体
- **THEN** 采集只包含播放/暂停等状态变化，不含逐秒观看或音量轨迹

### Requirement: 服务端触发决策核心

服务端 SHALL 按页面类型对行为证据加权，执行两阶段停顿确认、优先级队列、冷却与过期判定，并对同一事件在多标签页间保证最多一次气泡展示。决策核心 SHALL 为纯函数并可独立单测。

#### Scenario: 自然停顿两阶段确认
- **WHEN** 资源/教材页出现停顿候选后学生离开页面再返回
- **THEN** 返回页面后须再次满足确认条件才形成可投递事件

#### Scenario: 观看视频或页面隐藏不误触发
- **WHEN** 停顿窗口内存在媒体播放、页面隐藏或窗口失焦
- **THEN** 停顿候选被抑制，不形成可投递事件

#### Scenario: 冷却与过期
- **WHEN** 同类事件在冷却期内再次候选或事件超过有效期
- **THEN** 决策核心分别将其抑制或标记过期，不再投递

#### Scenario: 多标签页租约
- **WHEN** 同一浏览器多标签页同时满足同一事件展示条件
- **THEN** 多标签页间最多一次气泡展示

### Requirement: 陪伴事件与投递数据模型

系统 SHALL 以 `KonlingCompanionEvent` 记录候选/确认/投递事件，以 `KonlingCompanionDelivery` 记录会话投递与治理资源快照（resourceId、版本/内容哈希、原因摘要）。该数据 SHALL NOT 写入 `LearningFact`，SHALL NOT 进入学生画像或教师端任何投影。

#### Scenario: 事件生命周期可审计
- **WHEN** 事件从候选到投递演进
- **THEN** 状态与时间戳可从表中追溯，不依赖客户端自述

#### Scenario: 投递资源快照可校验
- **WHEN** 会话恢复时读取投递资源卡
- **THEN** 系统按 resourceId 与版本/内容哈希重新校验权限和版本，失效只降级对应卡片

### Requirement: 低打扰气泡呈现

气泡 SHALL 非模态、不播放声音、不震动、不发系统通知，约 10–15 秒自动收起，同一事件不重复展示；气泡 SHALL 复用网页设计 token。侧栏输入或流式生成期间 SHALL NOT 被普通陪伴气泡打断。

#### Scenario: 气泡自动收起且不重复
- **WHEN** 气泡展示后学生未点击
- **THEN** 约 10–15 秒后自动收起，同一事件不再重复展示

#### Scenario: 流式生成期间不打断
- **WHEN** 控灵侧栏正在输入或流式生成
- **THEN** 普通陪伴气泡不弹出

### Requirement: 会话集成与主动回合

点击气泡 SHALL 复用最近匹配的学生私有控灵会话或创建新会话；服务端 SHALL 写入 companion-origin 助手消息并执行一次主动回合，SHALL NOT 伪造用户消息。

#### Scenario: 复用或创建私有会话
- **WHEN** 学生点击气泡
- **THEN** 打开控灵侧栏并定位到复用或新建的学生私有会话，主动回合由 companion-origin 助手消息发起

### Requirement: 会话内治理资源呈现

会话内资源 SHALL 仅来自治理注册表，保存稳定 resourceId、版本/内容哈希与原因摘要；视频/录音 SHALL 支持播放、暂停、继续、进度拖动、音量/静音与视频原生全屏，SHALL 禁止自动播放；互动资源卡 SHALL 先说明资源是什么、解决什么问题、预计用时和完成内容，再提供站内跳转；教材无可靠跳转时 SHALL 展示摘要并允许继续讲解。

#### Scenario: 视频全屏退出后会话位置恢复
- **WHEN** 学生在会话内视频全屏后退出全屏
- **THEN** 会话滚动位置保持，播放器不自动重新播放

#### Scenario: 资源失效降级
- **WHEN** 投递资源在打开时校验失败
- **THEN** 仅对应资源卡降级显示原因，会话与会话内其他资源不受影响

### Requirement: 首期触发场景

系统 SHALL 支持四类首期触发：资源/教材页自然停顿提醒、自适应练习错题安慰与帮助、有效学习进步表扬、资源完成后的下一步建议。错题安慰气泡 SHALL NOT 直接显示知识点，点击后在会话内展示知识点与已治理资源。

#### Scenario: 错题安慰
- **WHEN** 学生在自适应练习提交错误答案并满足触发条件
- **THEN** 出现安慰气泡，气泡不直接显示知识点；点击后在会话内显示知识点和已治理资源

### Requirement: 降级与开关

feature flag `KONLING_COMPANION_ENABLED` 关闭、服务端异常、评分不确定或上下文不可靠时 SHALL NOT 弹气泡；普通控灵与学习流程 SHALL 保持可用。

#### Scenario: flag 关闭
- **WHEN** 环境未启用主动陪伴
- **THEN** 不出现气泡与陪伴请求，普通控灵会话不受影响

### Requirement: 陪伴数据隐私边界

陪伴事件与投递数据 SHALL 仅供控灵运行时与策略评估；任何教师端视图、学生画像计算与 `LearningFact` 写入路径 SHALL NOT 读取或派生陪伴会话内容与投递记录。

#### Scenario: 教师端不可见
- **WHEN** 教师查看班级学情或学生详情
- **THEN** 陪伴事件、投递记录与会话内容不出现在任何教师投影

