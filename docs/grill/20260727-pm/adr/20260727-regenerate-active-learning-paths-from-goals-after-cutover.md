---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 正式切换后依据原目标重新生成未完成学习路径

正式权威切换时仍未完成的 legacy 学习路径停止继续执行，原步骤、执行记录和偏差记录只读归档，不建立旧步骤到 ActKG Canonical Object 的逐项映射。

系统保留路径已经声明的学习目标或用户意图。ActKG 教学语义可用并完成路径消费者迁移后，系统结合该目标和学生当前累计画像生成一条具有独立身份的新 Canonical 路径；旧路径执行历史不作为新节点身份或步骤序列的来源。

这一做法延续学习意图而不延续旧图谱结构，也避免正式切换后长期运行两套路径引擎。
