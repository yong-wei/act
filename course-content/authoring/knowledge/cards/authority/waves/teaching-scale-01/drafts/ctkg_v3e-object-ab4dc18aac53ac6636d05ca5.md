---
node_id: ctkg_v3e-object-ab4dc18aac53ac6636d05ca5
authority_entity_id: "ctkg:v3e-object-ab4dc18aac53ac6636d05ca5"
name: "全状态反馈设计步骤"
name_en: "Full-State Feedback Design Steps"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: draft
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c624143d47f24c9d8374a994b953107a789fb79e89452ca0d0b1f10a8301dee9.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c624143d47f24c9d8374a994b953107a789fb79e89452ca0d0b1f10a8301dee9.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-ab4dc18aac53ac6636d05ca5.md"
asset_refs: []
---

## 首页

# 全状态反馈设计步骤 | Full-State Feedback Design Steps

**一句话定义**：假设所有状态可用，通过确定反馈增益矩阵完成状态反馈设计的一组步骤。

**核心直觉**：先从模型和可控性开始，再选极点、算增益、验证输出和输入约束。

**关键公式**：
$$
\text{model}\to\text{controllability}\to\text{target poles}\to K\to\text{simulation}
$$

**学习目标**：按完整步骤组织一次状态反馈设计，并把理想极点与工程指标分开。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

全状态反馈设计不是只解一个矩阵方程。先确定状态、输入和输出定义，检查可控性，再将时域要求转换为目标极点，求 K 后复核闭环、控制量和模型误差。若状态不可直接测量，设计还需接入观测器并检查分离原理的条件。

### 教学计算/推理例

对 A=[[0,1],[-2,-3]]、B=[[0],[1]]，可控性矩阵 [[0,1],[1,−3]] 满秩。若目标极点为 −2、−4，上一算例给出 K=[6,3]；最后还要模拟阶跃和限幅，而不是停在系数匹配。

### 适用条件与边界

假设连续 LTI、状态估计误差可控、执行器有明确边界且符号约定一致。设计点与生产运行点有偏差时必须做鲁棒复核。

### 自检

1. 设计的第一步是直接求 K 吗？
2. 状态不可测时能否仍称为“全状态可用”的实现？

**核对要点**：不是，先定义模型并检查可控性；不能，需说明状态测量或观测器。

### 关联节点

- **状态空间分步设计法**（入边，关系：相关）
- **调节器**（入边，关系：相关）
- **状态反馈控制设计方法**（入边，关系：相关）
- **若全状态反馈控制律能使系统稳定（在假设可获得全部状态的前提下），且观测器是稳定的（跟踪误差渐近稳定），则闭环系统的稳定性得到保证。**（出边，关系：相关）
- **全状态反馈**（出边，关系：适用于）
