# 教师默认班级发布与回退

默认班级是教师开课时的选择偏好，不是历史课堂的归属依据。`ClassSession.classId` 仅在新建课堂时由教师明确选择；任何默认班级调整、停用或回填都不得修改既有课堂记录。

## 发布顺序

1. 在应用仍允许旧开课行为时部署 Prisma expand migration `20260724090000_add_teacher_default_class`。该迁移只增加可空的 `User.defaultTeachingClassId`，不修改 `ClassSession.classId`。
2. 部署包含默认班级领域服务和班级生命周期路由的新应用版本。此时教师不提交班级仍保持兼容，强制绑定尚未启用。
3. 确认所有旧应用实例已停止，且只有新班级生命周期服务仍在写入班级。
4. 在目标 PostgreSQL 环境先执行只读计划：

   ```bash
   npm run db:reconcile-teacher-default-classes -- --dry-run
   ```

5. 确认计划计数后执行回填。命令在 `Serializable` 事务中取得事务级 advisory lock；重复执行安全：

   ```bash
   npm run db:reconcile-teacher-default-classes -- --apply --writer-drained
   npm run db:reconcile-teacher-default-classes -- --verify
   ```

6. 运行教师开课入口 inventory gate，确认没有教师入口绕过共享启动器或省略 `classId`。
7. 仅当第 5 步验证为零违规且第 6 步通过后，记录两个 gate receipt 并启用教师 `classId` 强制校验：

   ```bash
   npm run db:reconcile-teacher-default-classes -- --apply --writer-drained --producer-inventory-verified --enable-teacher-class-binding
   ```

该命令把可验证 receipt 写入 `PlatformSetting.teacher_class_binding_enforcement`；会话 API 只有在 receipt 同时包含不变量验证和入口 inventory 验证时间时，才拒绝教师临时课堂。管理员仍可在不带 `classId` 的情况下创建临时课堂。

## 不变量验证

`--verify` 必须为零违规，覆盖以下条件：

- 非教师不得持有默认班级；
- 默认班级必须属于该教师并处于启用状态；
- 有启用班级的教师必须存在一个有效默认班级；
- 没有启用班级的教师不得保留默认班级；
- 默认班级引用不得重复。

回填总是按 `createdAt DESC, id DESC` 选择最新启用班级，但保留仍然有效的既有默认选择。

## 回退

出现启动器或强制校验异常时，先部署将教师会话绑定视为未启用的上一应用版本；原始班级、默认偏好和已有 `ClassSession.classId` 无需回滚或重写。禁止通过默认偏好推断或回填历史 classless 会话。

若需要再次发布，重新按本页顺序执行 writer drain、reconciliation、`--verify` 和入口 inventory gate；回填命令可安全重跑。
