# Design

资源按规范知识节点聚合，但关系覆盖来自 v2 每个错误选项。验证题从同一规范目标的已审核 v2 题目中做确定性循环置换，保证题目身份、内容哈希和来源题不同，同时保持可审计 revision。

运行时默认读取 v2 attribution、v2 baseline、resource projection 和 validation registry；v1 文件保持只读历史兼容。
