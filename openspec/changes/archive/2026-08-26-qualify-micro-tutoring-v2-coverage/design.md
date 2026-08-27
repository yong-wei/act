# Design

v1 覆盖审计继续读取 practice baseline 与 v1 资源/验证工件。v2 审计读取 `micro-tutoring-assessment-baseline-v2.json`、v2 归因、v2 资源投影和 v2 验证注册表，分母锁定 135 题：practice 54、checkpoint 27、remediation 27、readiness/readiness-gate 合计 27。错误选项分母以当前 v2 归因目录为准（272）。

资格回执使用独立版本 `micro-tutoring-production-qualification.v2`。生成前必须证明工作树洁净、捕获修订一致、严格覆盖完整，以及必需的 coverage/postgres/browser 证明绑定同一 revision。激活评估继续只返回 candidate-only 或 rollback-required，不得改写生产 selector。

浏览器证据覆盖四类真实入口：practice、checkpoint、readiness、remediation。全量正确性仍由程序化审计负责。
