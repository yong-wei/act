from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib import font_manager


SEED = 5505
RAW_DIR = Path(__file__).resolve().parent
LESSON_DIR = RAW_DIR.parent.parent
PROCESSED_DIR = LESSON_DIR / 'media' / 'processed'
DATA_DIR = RAW_DIR / 'generated-data'


def configure_fonts() -> None:
  candidates = [
    'Hiragino Sans GB',
    'PingFang SC',
    'Noto Sans CJK SC',
    'Microsoft YaHei',
    'Arial Unicode MS',
  ]
  installed = {font.name for font in font_manager.fontManager.ttflist}
  for name in candidates:
    if name in installed:
      plt.rcParams['font.sans-serif'] = [name]
      break
  plt.rcParams['axes.unicode_minus'] = False
  plt.rcParams['figure.dpi'] = 160
  plt.rcParams['savefig.dpi'] = 220


def moving_average(values: list[float], width: int) -> np.ndarray:
  arr = np.asarray(values, dtype=float)
  if len(arr) < width:
    return arr
  kernel = np.ones(width) / width
  return np.convolve(arr, kernel, mode='valid')


def y_to_state(y: float, states: np.ndarray) -> int:
  return int(np.argmin(np.abs(states - y)))


def run_toy_q_learning(rng: np.random.Generator) -> dict:
  states = np.linspace(-2.0, 2.0, 41)
  actions = np.array([-0.24, 0.0, 0.24])
  q_table = np.zeros((len(states), len(actions)))
  rewards: list[float] = []
  alpha = 0.18
  gamma = 0.92

  for episode in range(240):
    y = float(rng.uniform(-1.8, 1.8))
    total_reward = 0.0
    epsilon = max(0.05, 0.45 * (1.0 - episode / 240))
    for _ in range(30):
      state = y_to_state(y, states)
      if rng.random() < epsilon:
        action_idx = int(rng.integers(0, len(actions)))
      else:
        action_idx = int(np.argmax(q_table[state]))
      u = float(actions[action_idx])
      y_next = float(np.clip(y + u + rng.normal(0.0, 0.025), -2.0, 2.0))
      boundary_penalty = 2.5 if abs(y_next) > 1.75 else 0.0
      reward = abs(y) - abs(y_next) - 0.04 * u**2 - boundary_penalty
      next_state = y_to_state(y_next, states)
      q_table[state, action_idx] += alpha * (
        reward + gamma * np.max(q_table[next_state]) - q_table[state, action_idx]
      )
      total_reward += reward
      y = y_next
    rewards.append(total_reward)

  def rollout(policy: str, start: float = 1.65) -> dict:
    y = start
    trajectory = [y]
    controls = []
    total_reward = 0.0
    for _ in range(28):
      if policy == 'learned':
        action_idx = int(np.argmax(q_table[y_to_state(y, states)]))
      elif policy == 'proportional':
        action_idx = 0 if y > 0.12 else (2 if y < -0.12 else 1)
      else:
        action_idx = int(rng.integers(0, len(actions)))
      u = float(actions[action_idx])
      y = float(np.clip(y + u, -2.0, 2.0))
      reward = -abs(y) - 0.04 * u**2
      total_reward += reward
      controls.append(u)
      trajectory.append(y)
    return {
      'trajectory': trajectory,
      'controls': controls,
      'total_reward': total_reward,
      'final_abs_error': abs(trajectory[-1]),
      'mean_abs_control': float(np.mean(np.abs(controls))),
    }

  learned = rollout('learned')
  proportional = rollout('proportional')
  random_policy = rollout('random')
  return {
    'episode_rewards': rewards,
    'moving_average_20': moving_average(rewards, 20).tolist(),
    'learned_rollout': learned,
    'proportional_rollout': proportional,
    'random_rollout': random_policy,
  }


@dataclass(frozen=True)
class Scenario:
  left_clearance: float
  right_clearance: float
  confidence: float
  traffic_density: float
  cross_current: float
  actuator_margin: float
  rule_bias: float


def sample_scenario(rng: np.random.Generator) -> Scenario:
  traffic = float(rng.beta(2.2, 2.0))
  confidence = float(0.55 + 0.45 * rng.beta(2.4, 1.7))
  current = float(rng.beta(1.8, 3.0))
  margin = float(0.45 + 0.55 * rng.beta(2.0, 1.8))
  base_clearance = 0.85 - 0.42 * traffic + rng.normal(0.0, 0.08)
  asymmetry = rng.normal(0.0, 0.24)
  left = float(np.clip(base_clearance + asymmetry, 0.05, 1.0))
  right = float(np.clip(base_clearance - asymmetry + rng.normal(0.0, 0.05), 0.05, 1.0))
  rule_bias = float(rng.choice([-1.0, 1.0]) * rng.beta(2.0, 2.5))
  return Scenario(left, right, confidence, traffic, current, margin, rule_bias)


def state_index(s: Scenario) -> tuple[int, int, int, int]:
  left_bin = int(np.digitize(s.left_clearance, [0.28, 0.55]))
  right_bin = int(np.digitize(s.right_clearance, [0.28, 0.55]))
  confidence_bin = int(s.confidence >= 0.74)
  traffic_bin = int(s.traffic_density >= 0.52)
  return left_bin, right_bin, confidence_bin, traffic_bin


def action_cost(s: Scenario, action: int, prev_action: int | None = None) -> float:
  # action: 0 keep, 1 left, 2 right
  if action == 0:
    selected_clearance = min(s.left_clearance, s.right_clearance)
    turn_cost = 0.02
    rule_cost = 0.25 * s.traffic_density
  elif action == 1:
    selected_clearance = s.left_clearance
    turn_cost = 0.18
    rule_cost = 0.18 * max(0.0, s.rule_bias)
  else:
    selected_clearance = s.right_clearance
    turn_cost = 0.18
    rule_cost = 0.18 * max(0.0, -s.rule_bias)

  near_risk = max(0.0, 0.45 - selected_clearance)
  low_confidence = max(0.0, 0.72 - s.confidence)
  margin_penalty = max(0.0, 0.72 - s.actuator_margin)
  smooth_cost = 0.0 if prev_action is None or prev_action == action else 0.13
  uncertainty = (0.45 * low_confidence + 0.25 * s.cross_current) * (1.0 + s.traffic_density)
  return float(
    10.0 * near_risk**2
    + 1.2 * uncertainty
    + 0.65 * margin_penalty
    + turn_cost
    + rule_cost
    + smooth_cost
  )


def rule_policy(s: Scenario) -> int:
  if s.traffic_density < 0.36 and min(s.left_clearance, s.right_clearance) > 0.50:
    return 0
  diff = s.left_clearance - s.right_clearance
  if abs(diff) < 0.12:
    return 0
  return 1 if diff > 0 else 2


def train_contextual_policy(rng: np.random.Generator) -> dict:
  q = np.zeros((3, 3, 2, 2, 3))
  visits = np.zeros_like(q)
  rewards: list[float] = []
  alpha = 0.12
  for step in range(5200):
    scenario = sample_scenario(rng)
    idx = state_index(scenario)
    epsilon = max(0.04, 0.35 * (1.0 - step / 5200))
    if rng.random() < epsilon:
      action = int(rng.integers(0, 3))
    else:
      action = int(np.argmax(q[idx]))
    reward = -action_cost(scenario, action)
    q[idx + (action,)] += alpha * (reward - q[idx + (action,)])
    visits[idx + (action,)] += 1
    rewards.append(float(reward))

  def learned_policy(s: Scenario) -> int:
    action = int(np.argmax(q[state_index(s)]))
    selected_clearance = (
      min(s.left_clearance, s.right_clearance)
      if action == 0
      else s.left_clearance
      if action == 1
      else s.right_clearance
    )
    if selected_clearance < 0.20:
      return 1 if s.left_clearance >= s.right_clearance else 2
    return action

  return {
    'q': q,
    'visits': visits,
    'episode_rewards': rewards,
    'moving_average_100': moving_average(rewards, 100).tolist(),
    'policy': learned_policy,
  }


def evaluate_policies(rng: np.random.Generator, learned_policy) -> dict:
  rows = []
  metrics = {
    'traditional_rule': {'total_cost': 0.0, 'near_events': 0, 'clearance': [], 'actions': []},
    'learned_policy': {'total_cost': 0.0, 'near_events': 0, 'clearance': [], 'actions': []},
    'oracle': {'total_cost': 0.0, 'near_events': 0, 'clearance': [], 'actions': []},
  }
  prev_actions = {name: None for name in metrics}

  for step in range(260):
    scenario = sample_scenario(rng)
    actions = {
      'traditional_rule': rule_policy(scenario),
      'learned_policy': int(learned_policy(scenario)),
      'oracle': int(np.argmin([action_cost(scenario, a) for a in range(3)])),
    }
    for name, action in actions.items():
      cost = action_cost(scenario, action, prev_actions[name])
      selected_clearance = (
        min(scenario.left_clearance, scenario.right_clearance)
        if action == 0
        else scenario.left_clearance
        if action == 1
        else scenario.right_clearance
      )
      metrics[name]['total_cost'] += cost
      metrics[name]['near_events'] += int(selected_clearance < 0.20)
      metrics[name]['clearance'].append(float(selected_clearance))
      metrics[name]['actions'].append(action)
      prev_actions[name] = action
    if step < 48:
      rows.append({
        'step': step + 1,
        'left_clearance': scenario.left_clearance,
        'right_clearance': scenario.right_clearance,
        'traffic_density': scenario.traffic_density,
        'traditional_rule_action': actions['traditional_rule'],
        'learned_policy_action': actions['learned_policy'],
      })

  summary = {}
  for name, data in metrics.items():
    actions = np.asarray(data['actions'])
    changes = int(np.sum(actions[1:] != actions[:-1]))
    summary[name] = {
      'mean_cost': data['total_cost'] / len(data['actions']),
      'near_events': int(data['near_events']),
      'mean_clearance': float(np.mean(data['clearance'])),
      'action_changes': changes,
    }
  return {'summary': summary, 'trace': rows, 'raw_metrics': metrics}


def plot_toy_demo(toy: dict, output: Path) -> None:
  fig, axes = plt.subplots(1, 2, figsize=(10.8, 4.2), constrained_layout=True)
  ax = axes[0]
  ma = np.asarray(toy['moving_average_20'])
  ax.plot(np.arange(len(ma)) + 20, ma, color='#2f6f9f', linewidth=2.2)
  ax.set_title('小例子：回报随训练改善')
  ax.set_xlabel('训练轮次')
  ax.set_ylabel('20轮平均累计回报')
  ax.grid(True, alpha=0.24)

  ax = axes[1]
  for key, label, color in [
    ('random_rollout', '随机动作', '#9a9a9a'),
    ('proportional_rollout', '显式比例修正', '#d98b2b'),
    ('learned_rollout', '学习策略', '#2f7d4f'),
  ]:
    trajectory = toy[key]['trajectory']
    ax.plot(trajectory, label=label, color=color, linewidth=2.0)
  ax.axhline(0, color='#333333', linewidth=0.9, linestyle='--')
  ax.set_title('同一起点下的横向误差收敛')
  ax.set_xlabel('决策步')
  ax.set_ylabel('横向误差')
  ax.grid(True, alpha=0.24)
  ax.legend(frameon=False, loc='upper right')
  fig.savefig(output, bbox_inches='tight')
  plt.close(fig)


def plot_case_compare(training: dict, evaluation: dict, output: Path) -> None:
  fig, axes = plt.subplots(2, 2, figsize=(11.4, 7.6), constrained_layout=True)
  ax = axes[0, 0]
  ma = np.asarray(training['moving_average_100'])
  ax.plot(np.arange(len(ma)) + 100, ma, color='#2f6f9f', linewidth=2.1)
  ax.set_title('候选动作策略的仿真训练回报')
  ax.set_xlabel('仿真交互次数')
  ax.set_ylabel('100次平均回报')
  ax.grid(True, alpha=0.24)

  summary = evaluation['summary']
  names = ['traditional_rule', 'learned_policy', 'oracle']
  labels = ['传统规则', '学习策略', '理想选择']
  colors = ['#d98b2b', '#2f7d4f', '#5b6fa3']
  x = np.arange(len(names))
  ax = axes[0, 1]
  ax.bar(x, [summary[name]['mean_cost'] for name in names], color=colors)
  ax.set_xticks(x, labels)
  ax.set_title('平均单步代价')
  ax.set_ylabel('越低越好')
  ax.grid(axis='y', alpha=0.22)

  ax = axes[1, 0]
  trace_len = len(evaluation['trace'])
  for name, label, color in [
    ('traditional_rule', '传统规则', '#d98b2b'),
    ('learned_policy', '学习策略', '#2f7d4f'),
  ]:
    ax.plot(
      evaluation['raw_metrics'][name]['clearance'][:trace_len],
      color=color,
      linewidth=2.0,
      label=label,
    )
  ax.axhline(0.20, color='#b13c3c', linestyle='--', linewidth=1.2, label='近碰阈值')
  ax.set_title('压力场景中的最小安全余量')
  ax.set_xlabel('决策步')
  ax.set_ylabel('安全余量')
  ax.grid(True, alpha=0.24)
  ax.legend(frameon=False)

  ax = axes[1, 1]
  width = 0.34
  ax.bar(
    x - width / 2,
    [summary[name]['near_events'] for name in names],
    width=width,
    color=colors,
    alpha=0.9,
    label='近碰次数',
  )
  ax.bar(
    x + width / 2,
    [summary[name]['action_changes'] for name in names],
    width=width,
    color=colors,
    alpha=0.45,
    label='动作切换次数',
  )
  ax.set_xticks(x, labels)
  ax.set_title('安全事件与动作平滑性')
  ax.grid(axis='y', alpha=0.22)
  ax.legend(frameon=False)
  fig.savefig(output, bbox_inches='tight')
  plt.close(fig)


def main() -> None:
  configure_fonts()
  rng = np.random.default_rng(SEED)
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

  toy = run_toy_q_learning(rng)
  training = train_contextual_policy(rng)
  evaluation = evaluate_policies(rng, training['policy'])

  metrics = {
    'seed': SEED,
    'toy': {
      'learned_final_abs_error': toy['learned_rollout']['final_abs_error'],
      'proportional_final_abs_error': toy['proportional_rollout']['final_abs_error'],
      'random_final_abs_error': toy['random_rollout']['final_abs_error'],
      'learned_total_reward': toy['learned_rollout']['total_reward'],
      'proportional_total_reward': toy['proportional_rollout']['total_reward'],
      'random_total_reward': toy['random_rollout']['total_reward'],
    },
    'case': evaluation['summary'],
  }
  (DATA_DIR / '5-5-rl-policy-simulation.json').write_text(
    json.dumps(metrics, ensure_ascii=False, indent=2),
    encoding='utf-8',
  )
  (DATA_DIR / '5-5-case-trace.json').write_text(
    json.dumps(evaluation['trace'], ensure_ascii=False, indent=2),
    encoding='utf-8',
  )

  plot_toy_demo(toy, PROCESSED_DIR / '5-5-rl-toy-demo.png')
  plot_case_compare(training, evaluation, PROCESSED_DIR / '5-5-autonomous-navigation-policy-compare.png')


if __name__ == '__main__':
  main()
