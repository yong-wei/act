## Why

成长中枢已经根据已验证学习证据生成“下一步建议”，但建议没有稳定连接到学生可执行的学习入口：接口没有返回推荐行动地址，页面退化为 `#`；诊断卡片还使用已失效的 `/courses` 路径。学生因此看到了建议，却无法从建议继续学习，学习陪伴链路在诊断与行动之间中断。

## What Changes

- 为成长诊断和推荐结果提供可验证的学生学习行动地址。
- 将无法定位具体资源时的默认入口统一为正式互动课程目录 `/interactive-learning/courses`。
- 禁止学生端把缺失行动地址渲染为空链接或失效旧路由；无法执行时显示明确的不可用状态。
- 增加 API、诊断组件和浏览器导航验收，覆盖有效建议、缺失地址和正式课程入口。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `role-based-learning-diagnosis`: 学生诊断的下一步行动必须是有效、可达且不改变学习状态的正式学习入口。

## Impact

- 影响 `GET /api/student/competency-snapshot` 的推荐与诊断投影。
- 影响 `/profile/growth` 推荐卡片和诊断卡片的导航行为。
- 影响成长诊断相关组件测试、路由烟雾测试和 OpenSpec 验收；不改变证据计算、成绩、解锁或路径规划规则。
