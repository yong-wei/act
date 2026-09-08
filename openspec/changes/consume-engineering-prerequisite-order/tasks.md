## 1. 工程顺序输入

- [x] 1.1 从已发布且与教学绑定同 snapshot 的 Authority 读取明确直接的 prerequisite，保留 relation ID 与方向
- [x] 1.2 身份、端点、环与缺失输入验证；不转写或声称存在新的 ACT_TEACHING REQUIRED

## 2. 生产路径接线

- [x] 2.1 在资格过滤与请求排序后建立 canonical 到合格资源的索引
- [x] 2.2 每个未满足的前驱选择一个代表资源，支持递归先修与一个资源覆盖多个前驱
- [x] 2.3 将解析结果写入请求级派生 registry，确保 repair、assembly 和解释使用同一输入
- [x] 2.4 对缺少前置资源、环或预算不可行返回明确限制，不产生违反先修的 ready 路径

## 3. 解释与验证

- [x] 3.1 路径证据保留工程 relation、snapshot、方向及资源 binding 来源，区分教学推荐
- [x] 3.2 覆盖多资源替代、多个前驱、共享代表、完成状态、确定性、缺资源、环及预算的回归
- [x] 3.3 从生产 planLearningPath 入口验证工程顺序生效，运行相关测试、typecheck 和全量验证
- [x] 3.4 OpenSpec strict 与独立审查
