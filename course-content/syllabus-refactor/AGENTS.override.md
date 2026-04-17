# AGENTS.override.md

## 适用范围

本目录用于模块与单元边界文稿、模块设计说明和相关人读版设计文档，包括但不限于：

- `module-skeletons.md`
- `unit-design-details.md`
- `unit-design-details/*.md`

这些文件继承上层 [course-content/AGENTS.override.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/AGENTS.override.md) 的总闸门；本文件只补模块设计文稿的专用要求。

---

## 文风要求

- 允许保留适度边界说明、接口说明和方案判断，但解释段落仍应以对象、能力、证据、风险判断为主。
- 资源采用级别、排除理由、后续接口、回写要求优先放在表格、评审单或决策块中，不直接长成自然段主干。
- 压制“必须 / 不允许 / 为后续保留 / 当前排除 / 回收 / 移交 / 压实”等项目管理文风在解释段落中的高频出现。

---

## 结构建议

- 当文档既承担设计说明又承担人读解释时，优先把内容拆成“判断性 prose”与“接口/评审表”两层。
- 判断性 prose 负责说明为什么这样组织内容、关键能力落点在哪里、主要证据怎样支撑这一安排。
- 接口/评审表负责承接资源采用、边界、排除项、产物约束和后续接口，避免这些内容淹没 prose。
