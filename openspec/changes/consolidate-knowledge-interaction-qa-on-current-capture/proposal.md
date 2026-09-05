## Why

图谱交互已有当前产品 QA 捕获，商业 UI 检查却还独立读取旧 #485 证据，要求固定截图尺寸、初始布局版本和旧 harness 字段。过期格式造成重复检查和历史文件缺失失败，无法代表当前图谱是否稳定。

## What Changes

- 将交互稳定性校验合并到现有产品 QA 的交互状态，删除独立 #485 reader、旧格式校验和仅约束它的测试。
- 复用当前拖动前后、悬停后和详情状态采样，补齐缺少的实际行为比较；不接受硬编码成功布尔值代替观测。
- 保留真实抖动、选中丢失、拖动固定失效等失败；历史证据继续作为历史记录。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `commercial-ui-governance-gates`：图谱交互检查使用当前 QA 捕获，不再依赖旧 #485 格式。

## Impact

主要修改 `scripts/tests/test-commercial-ui-governance.ts`、`capture-knowledge-workspace-product-qa.ts` 及其测试。复用现有 QA 入口、状态矩阵和共享图谱行为测试，不修改图谱产品代码、重建 QA 系统或删除历史文件。
