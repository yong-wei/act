# Student Learning Copilot Reflection

This context defines the language for the student-facing AI companion flow that helps a learner turn verified learning evidence into a portfolio reflection candidate.

## Language

**作品集反思**:
围绕一次自动控制学习任务，对已验证证据、学习意图、采用的建议、仍待验证的问题和下一步行动进行整理的学习活动。它产生候选草稿，不等同于正式学习档案或官方成绩。
_避免_: 普通聊天、自动生成正式成绩、自动写入学习画像

**任务上下文**:
本次 Copilot 请求的受治理任务语义，包括任务类型、来源、学习任务、意图、输出目标和写回边界。它不是客户端可以自由声明的内部运行上下文。
_避免_: 原始页面上下文、模型提示词、客户端权限声明

**验证证据**:
已经由平台记录并通过相应质量或来源规则确认、可以支持学习解释的结果摘要。AI 可以解释它，但不能把未经验证的推断伪装成验证证据。
_避免_: 原始模型回答、任意用户输入、内部诊断对象

**候选草稿**:
由 Copilot 生成、等待学生检查和明确保存的反思内容。候选草稿在明确保存前不改变正式学习档案、LearningFact、学习画像或官方成绩。
_避免_: 已保存反思、正式学习事实、自动写回

**服务端任务契约**:
服务端对客户端任务意图进行验证、归一化和边界控制后形成的可执行任务定义。只有契约允许的任务上下文和输出目标才能进入模型运行上下文。
_避免_: 信任客户端传入的 taskContext、客户端自定义写回策略
