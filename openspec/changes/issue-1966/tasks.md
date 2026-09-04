# 任务：控灵主动陪伴（issue-1966）

## 1. 批 1：数据模型与决策核心

- [x] 1.1 `prisma/schema.prisma` 新增 `KonlingCompanionEvent`、`KonlingCompanionDelivery`（含索引与 Delivery.eventId 唯一约束），生成迁移并补回填/验证脚本
- [x] 1.2 新增 `src/features/ai/companion/trigger-engine.ts`：事件状态机（candidate/confirmed/delivered/suppressed/expired）、按页面类型证据加权、两阶段停顿确认窗口、优先级队列、冷却、过期与投递去重纯函数
- [x] 1.3 单测 `trigger-engine.test.ts`：两阶段确认、返回页面重新满足条件、媒体播放/隐藏/失焦抑制、冷却、过期、优先级抢占、多标签去重语义

## 2. 批 2：陪伴 API 与隐私边界

- [x] 2.1 新增陪伴 API 路由：事件上报（POST）、二次确认（PATCH）、投递（POST）；仅认证学生本人，服务端时间戳权威
- [ ] 2.2 投递路径接入 konling-agent-runtime：复用或创建学生私有会话、写入 companion-origin 助手消息并执行一次主动回合（不伪造用户消息）
- [ ] 2.3 隐私边界测试：陪伴表不写 `LearningFact`、教师端投影与学生画像计算不读取陪伴数据、API 越权访问拒绝

## 3. 批 3：Provider 采集与气泡

- [ ] 3.1 `global-ai-provider.tsx` 扩展：可见性/焦点/最近有效操作/媒体状态采集、`isStreamingOrComposing`、companion entry 通道与 flag 门控
- [x] 3.2 新增类型化上报 Hook `useKonlingCompanionReporter`（题目、互动步骤、资源、播放状态粗粒度事件）
- [ ] 3.3 新增 `KonlingCompanionBubble`：非模态、10–15 秒自动收起、同事件不重复（会话级 Set + localStorage）、流式/输入期间抑制、点击打开侧栏并定位会话；多标签 localStorage 租约
- [ ] 3.4 组件测试：自动收起、去重、抑制条件、租约互斥与设计 token 使用

## 4. 批 4：会话资源呈现与布点

- [ ] 4.1 会话内治理资源卡：resourceId/版本哈希/原因摘要快照、打开/恢复重校验（权限与版本）、失效降级仅影响对应卡片
- [ ] 4.2 媒体控件：视频/录音播放、暂停、继续、进度拖动、音量/静音、视频原生全屏，禁止自动播放，全屏退出后会话位置恢复
- [ ] 4.3 互动资源卡先说明资源定位（是什么/解决什么/预计用时/完成内容）再提供站内跳转；教材无可靠跳转时展示摘要并允许继续讲解
- [ ] 4.4 布点：资源/教材页（停顿 + 完成建议）、自适应练习页（错题安慰 + 进步表扬）；错题气泡不直接显示知识点
- [ ] 4.5 端到端回归：四类触发场景、flag 关闭降级、服务端异常降级、普通控灵不受影响

## 5. 验证与交付

- [ ] 5.1 相关 Vitest 套件全过；typecheck 零错误；eslint 零新增告警；迁移与数据治理门禁通过
- [ ] 5.2 strict validate + specs 同步 + archive 与实现同一 PR 交付单元
