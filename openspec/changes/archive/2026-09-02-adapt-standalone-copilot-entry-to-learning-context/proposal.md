## Why

独立 `/ai/copilot` 的服务端页面上下文声明为“通用学习辅助”，但默认欢迎说明、快捷问题、输入示例和能力承诺全部固定为船舶航向控制、PID、诺莫托模型和 CCS 规范。未从仿真任务进入的学生会被引导去请求当前页面并未绑定的仿真状态和专业场景，页面还把单一演示内容包装成通用学习陪伴能力。

## What Changes

- 根据服务端已验证的任务契约、学习证据状态和当前允许能力生成独立 Copilot 的标题、说明、建议问题、输入示例和下一步行动。
- 在没有受治理任务或证据上下文时展示中性的通用学习陪伴状态，不默认假设船舶、PID、CCS 或任何仿真运行态。
- 保持作品集反思和 Evidence Copilot 的现有任务边界，并让对应入口继续显示任务匹配的建议问题。
- 禁止建议问题或能力文案承诺当前未绑定的工具、运行数据、证据或写回操作。
- 增加 generic、portfolio-reflection、evidence、empty/unavailable 和恶意 URL 上下文的组件与浏览器验收。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `standalone-copilot-conversation`: 独立 Copilot 的入口呈现必须与当前受治理任务上下文和实际可用能力一致，无任务时保持中性并说明限制。

## Impact

- Affected UI: `src/app/ai/copilot/page.tsx` 的欢迎区、快捷问题、输入提示和任务状态。
- Affected projections: 复用现有 reflection/evidence/task contracts，可能增加一个纯学生安全的 entry presentation helper。
- Affected tests/evidence: standalone Copilot component tests、Playwright 与 1440/320 Commercial UI evidence。
- No change to model provider, conversation persistence, evidence authorization, portfolio save or official learning records.

