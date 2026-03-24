# 自动评估规格 | 单元 L-2d：三域联动探索——平台操作初体验

**系统参数**：$G(s) = K / [s(s+1)(s+6)]$，临界增益 $K_{cr} = 42$（劳斯判据精确值）

---

## 设计原则

- **定量评分为主**：所有评分逻辑均为数值比较或不等式判断，不调用 LLM
- **即时反馈**：每次提交后立即显示该项得分和具体不一致说明（如有）
- **多次提交取最高分**：任务一、二允许重新提交，系统保留各次记录，显示最高分
- **过程记录完整**：每次提交（包括非最高分）均存档，供教师查看探索轨迹
- **LLM 仅用于课后总结**：任务三反思文字由 LLM 在课程结束后批量生成汇总评语，不参与即时评分
- **后台静默原则**：总分在课程结束后才对学生可见；每次提交只显示该项当次得分

---

## 数据观测点清单

### OBS-01｜任务一：临界增益 K

| 字段 | 说明 |
|------|------|
| 触发条件 | 学生点击"提交任务一" |
| 采集数据 | `k_critical: float`（学生填写的临界 K 值） |
| 允许提交次数 | 不限，取最高分 |

**评分逻辑**（满分 30 分）：

```
理论临界值 K_cr = 42.0（劳斯判据：特征方程 s³+7s²+6s+K=0，辅助方程 7×6−K=0）

if 36.0 ≤ k_critical ≤ 48.0:
    score_obs01 = 30
elif (28.0 ≤ k_critical < 36.0) or (48.0 < k_critical ≤ 56.0):
    score_obs01 = 15
    feedback = "你的值偏离临界点较多，试试在时域响应刚好出现等幅振荡时读取 K"
else:
    score_obs01 = 0
    feedback = "这个 K 值对应的系统还未到达临界状态，继续向临界方向调整"
```

**即时反馈文字**：
- 满分：「找到了！这就是临界增益附近。注意此时时域等幅振荡，相位裕度 γ ≈ 0°。」
- 半分：「方向正确，但还可以更精确。等幅振荡的那一刻就是临界点。」
- 零分：根据 k_critical 与 42 的大小关系，提示"偏小，继续增大 K"或"偏大，系统已经失稳"

---

### OBS-02｜任务二：三域对照表（4 行）

| 字段 | 说明 |
|------|------|
| 触发条件 | 学生每填完一行点击"记录这一行" |
| 采集数据 | `{k, sigma, omega, mp, ts, gamma}` × 4 行 |
| 允许提交次数 | 每行不限，取该行最高分 |

**单行评分逻辑**（满分 10 分/行，共 40 分）：

对每行数据 `(k, sigma, omega, mp, ts, gamma)` 做三项独立检验，每项通过得相应分：

**检验 A：极点与 $t_s$ 一致性（4 分）**
```
zeta_from_poles = abs(sigma) / sqrt(sigma² + omega²)
omega_n = sqrt(sigma² + omega²)
ts_expected = 4 / abs(sigma)   # 2% 准则

if abs(ts - ts_expected) / ts_expected < 0.30:
    score_A = 4
elif abs(ts - ts_expected) / ts_expected < 0.50:
    score_A = 2
    feedback_A = f"调节时间与极点实部不太吻合。参考：ts ≈ 4/|σ| = {ts_expected:.1f}s"
else:
    score_A = 0
    feedback_A = f"调节时间读数偏差较大。参考：ts ≈ 4/|σ| = {ts_expected:.1f}s"
```

**检验 B：极点与 $M_p$ 一致性（4 分）**
```
zeta = abs(sigma) / sqrt(sigma² + omega²)
mp_expected = 100 * exp(-pi * zeta / sqrt(1 - zeta²))  # 二阶近似

if abs(mp - mp_expected) < 20:    # 允许 20 个百分点误差（含三阶近似偏差）
    score_B = 4
elif abs(mp - mp_expected) < 35:
    score_B = 2
    feedback_B = f"超调量与阻尼比不太吻合。参考：ζ={zeta:.2f} 对应 Mp≈{mp_expected:.0f}%"
else:
    score_B = 0
    feedback_B = f"超调量读数偏差较大。参考：ζ={zeta:.2f} 对应 Mp≈{mp_expected:.0f}%"
```

**检验 C：$M_p$ 与 $\gamma$ 方向一致性（2 分）**
```
# 仅在有前序行时执行；第一行自动通过
# 取上一行（最高分那次）的 mp_prev, gamma_prev

if (mp > mp_prev and gamma < gamma_prev) or (mp < mp_prev and gamma > gamma_prev) or (mp == mp_prev):
    score_C = 2   # 方向正确：Mp 大则 γ 小
else:
    score_C = 0
    feedback_C = "超调量和相位裕度的变化方向不一致。Mp 增大时 γ 应该减小，请检查读数。"
```

**行总分**：`score_row = score_A + score_B + score_C`

**行级即时反馈**：列出各检验结果，不通过的项目给出参考值。

---

### OBS-03｜任务三：反思提交

| 字段 | 说明 |
|------|------|
| 触发条件 | 学生点击"提交反思" |
| 采集数据 | `{has_surprise_text: bool, selected_option: "A"/"B"/null, answer_text: string}` |
| 允许提交次数 | 1 次（反思不重做） |

**评分逻辑**（满分 30 分）：

```
# 必答项（20 分）
if len(surprise_text.strip()) >= 10:   # 至少 10 个字符
    score_required = 20
else:
    score_required = 0
    feedback = "请描述一个具体的现象（至少一句话）"

# 选答项（10 分）
if selected_option == "A" and len(answer_text.strip()) >= 10:
    score_optional = 10
elif selected_option == "B":
    # 检验学生是否填入了数值（不检验结论对错）
    if any(char.isdigit() for char in answer_text):
        score_optional = 10
    else:
        score_optional = 5
        feedback_optional = "选题B建议填入你在任务二中的具体数值来验证"
else:
    score_optional = 0

score_obs03 = score_required + score_optional
```

**课后 LLM 评价触发**：课程结束时，将全班 `answer_text` 汇总，生成班级整体反思报告（教师端可见），不发送给学生个人。

---

## 总分计算

```
total_score = score_obs01 + max(score_obs02_row1~4) + score_obs03
            = OBS-01(30) + OBS-02(40) + OBS-03(30)
            = 100 分满分
```

**显示时机**：
- 课程期间：仅显示每项当次提交得分（不显示累计总分）
- 课程结束后：学生端显示总分及各项明细；教师端额外显示全班分布和LLM反思汇总

---

## 平台实现说明

### 工作区约束配置

```json
{
  "system": "G(s) = K / [s(s+1)(s+6)]",
  "open_loop_poles": [0, -1, -6],
  "open_loop_zeros": [],
  "constraints": {
    "poles_fixed": true,        // 开环极点不可增删
    "zeros_fixed": true,        // 无零点，不可添加
    "k_range": [0.01, 80],      // K 调节范围（临界值42在约52%位置，操作手感合理）
    "allow_closed_loop_drag": true,  // 允许在根轨迹上拖动闭环极点（反推K）
    "k_slider_linked": true     // K 滑块与极点拖动双向联动
  }
}
```

### 数据上报 API

每次提交调用：
```
POST /api/sessions/{sessionId}/observations
{
  "obs_id": "OBS-01" | "OBS-02-row{1-4}" | "OBS-03",
  "student_id": string,
  "submitted_at": ISO8601,
  "data": { ...各字段 },
  "score": number,
  "feedback": string
}
```

### 课后 LLM 汇总触发

```
POST /api/sessions/{sessionId}/summarize
触发时机：教师点击"结束课堂"按钮
输入：全班 OBS-03 的 answer_text 列表
输出：写入 sessions/{sessionId}/llm_summary（教师端专有）
```
