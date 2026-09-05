## ADDED Requirements

### Requirement: Revoked learning facts do not invalidate portraits

消费者读取最新治理学习事实时 SHALL 依据 `LearnerFactTransition` 的每事实最终操作判定有效性；最终操作为 REVOKE 的事实 SHALL NOT 参与「较新有效事实」判定，已具备当前画像的学生 SHALL NOT 因其存在被标记为 `newer-learning-fact`。

#### Scenario: Newer revoked fact keeps portrait qualified

- **WHEN** 某学生学习事实的时间晚于画像证据截止时间，且该事实的最终 transition 操作为 REVOKE
- **THEN** 该学生的当前画像 SHALL 保持 `qualified`
- **AND** 教师班级覆盖统计 SHALL 继续计入该学生

#### Scenario: Newer valid fact still invalidates

- **WHEN** 某学生学习事实的时间晚于画像证据截止时间，且其最终 transition 操作为 UPSERT 或 CORRECT
- **THEN** 画像 SHALL 继续被标记为 `newer-learning-fact`
- **AND** 处理水位领先于画像状态水位的既有保护 SHALL 保持不变

#### Scenario: Mixed facts compare on valid facts only

- **WHEN** 学生同时存在已撤销事实与时间更晚的有效事实
- **THEN** 过期判定 SHALL 使用有效事实中的最新时间
- **AND** 仅存在已撤销事实（无有效事实）时 SHALL 视为无较新事实
