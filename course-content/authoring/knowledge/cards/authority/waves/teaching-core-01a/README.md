# 建模基础：6张作者态知识卡

本批范围固定为 `scope.json` 中 core-topic-01 的六个当前 v0.48 canonical 节点。卡片保留 Authority 身份、来源路径和来源 SHA-256；旧作者态内容保存在 `previous/`，不覆盖历史字节。

六张卡分别承担建模步骤、动态系统与状态记忆、仿真保真度、物理模型相似性、简化假设、机理建模与分析流程六个不同教学任务。正文使用已由 `verify-models.py` 验算的固定例：角速度模型、详细/简化模型比较、机械与 RLC 无量纲相似性。角速度和航向、同输入不同初态、物理单位和无量纲坐标、频率幅值比和附加相位均在正文中明确区分。

`verify-content.py` 检查 scope 与 source-inventory 的精确身份、三类 source_docs、来源 SHA-256、immutable neighborhood 的关系对象/谓词/方向、实际学习卡解析器和 KaTeX，并重新运行原模型验证。`inventory.json` 与 `numerical-verification.json` 只记录作者态验证结果，不写 runtime 或资源绑定。

卡片 frontmatter 使用 `card_version: 3`、`status: ready` 和 v0.48 snapshot。作者态 inventory 与数值报告保留制作时的待审状态；当前独立领域审核为 PASS，最终接受状态与字节分别由 accepted-scope.json 和 review-acceptance.json 记录。

## 本地接入验收

已激活 control-theory-engineering-v0.48-b13，累计 97 张全部通过可执行卡、图谱检查器、实际生成路径选入、受保护页面与 Markdown 数学渲染。浏览器验证系统建模领域到本批卡片、自检，主线程已检查截图。Authority 快照和先修关系不变，未写入学习事实，未发布服务器。
