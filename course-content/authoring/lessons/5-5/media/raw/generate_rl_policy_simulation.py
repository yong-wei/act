from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib import font_manager


SEED = 5505
DIRECT_RL_SEED = 5516
SCHEDULER_RL_SEED = 5530
EVALUATION_SEED = 5599
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


def wrap_degrees(angle: float) -> float:
  return float((angle + 180.0) % 360.0 - 180.0)


HEADING_ACTIONS = np.array([-3.0, -1.5, 0.0, 1.5, 3.0])
PID_GAIN_PROFILES = [
  {'name': '保守', 'kp': 0.64, 'kd': 6.80},
  {'name': '常规', 'kp': 0.90, 'kd': 4.60},
  {'name': '抗扰', 'kp': 1.44, 'kd': 7.10},
  {'name': '快速', 'kp': 1.76, 'kd': 5.70},
]
DT = 0.5
MAX_DELTA = 25.0
MAX_DELTA_STEP = 1.5
ERROR_BINS = np.array([-35.0, -24.0, -16.0, -10.0, -6.0, -3.0, -1.5, 1.5, 3.0, 6.0, 10.0, 16.0, 24.0, 35.0])
YAW_RATE_BINS = np.array([-4.0, -2.5, -1.4, -0.7, -0.25, 0.25, 0.7, 1.4, 2.5, 4.0])
RUDDER_BINS = np.array([-24.0, -18.0, -12.0, -7.0, -3.0, 3.0, 7.0, 12.0, 18.0, 24.0])
DISTURBANCE_BINS = np.array([-0.35, -0.18, -0.08, 0.08, 0.18, 0.35])


def heading_state_index(error: float, yaw_rate: float, rudder: float, disturbance: float) -> tuple[int, int, int, int]:
  error_bin = int(np.digitize(error, ERROR_BINS))
  rate_bin = int(np.digitize(yaw_rate, YAW_RATE_BINS))
  rudder_bin = int(np.digitize(rudder, RUDDER_BINS))
  disturbance_bin = int(np.digitize(disturbance, DISTURBANCE_BINS))
  return error_bin, rate_bin, rudder_bin, disturbance_bin


def heading_state_shape() -> tuple[int, int, int, int]:
  return (
    len(ERROR_BINS) + 1,
    len(YAW_RATE_BINS) + 1,
    len(RUDDER_BINS) + 1,
    len(DISTURBANCE_BINS) + 1,
  )


def scheduler_state_index(error: float, yaw_rate: float, rudder: float, disturbance: float) -> tuple[int, int, int, int]:
  error_bin = int(np.digitize(error, [-22.0, -12.0, -5.0, 5.0, 12.0, 22.0]))
  rate_bin = int(np.digitize(yaw_rate, [-2.0, -0.6, 0.6, 2.0]))
  rudder_bin = int(np.digitize(rudder, [-12.0, -4.0, 4.0, 12.0]))
  disturbance_bin = int(np.digitize(disturbance, [-0.12, 0.12]))
  return error_bin, rate_bin, rudder_bin, disturbance_bin


def scheduler_state_shape() -> tuple[int, int, int, int]:
  return (7, 5, 5, 3)


def pid_rudder(
  error: float,
  yaw_rate: float,
  prev_rudder: float,
  gains: dict | None = None,
) -> float:
  if gains is None:
    gains = PID_GAIN_PROFILES[1]
  raw = gains['kp'] * error - gains['kd'] * yaw_rate
  limited = float(np.clip(raw, -MAX_DELTA, MAX_DELTA))
  return float(np.clip(limited, prev_rudder - MAX_DELTA_STEP, prev_rudder + MAX_DELTA_STEP))


def nomoto_step(
  heading: float,
  yaw_rate: float,
  rudder: float,
  t_const: float,
  gain: float,
  disturbance: float,
) -> tuple[float, float]:
  yaw_acc = (gain * rudder + disturbance - yaw_rate) / t_const
  next_rate = yaw_rate + DT * yaw_acc
  next_heading = heading + DT * next_rate
  return float(next_heading), float(next_rate)


def edge_environment(params: dict, time: float, step: int, rng: np.random.Generator) -> tuple[float, float, float]:
  noise_series = params.get('disturbance_noise')
  if noise_series is None:
    noise = float(rng.normal(0.0, 0.01))
  else:
    noise = float(noise_series[step])

  if not params.get('edge_scenario', False):
    disturbance = params['disturbance'] + 0.04 * np.sin(0.06 * time) + noise
    return float(params['t_const']), float(params['gain']), float(disturbance)

  gust = 0.0
  if 12.0 <= time < 24.0:
    gust += 0.22
  if 35.0 <= time < 46.0:
    gust -= 0.18
  pulse = 0.16 * np.exp(-0.5 * ((time - 52.0) / 2.8) ** 2)
  slow_current = 0.06 * np.sin(0.22 * time)
  t_const = params['t_const'] * (1.0 + 0.32 / (1.0 + np.exp(-(time - 26.0) / 3.5)))
  gain = params['gain'] * (1.0 - 0.28 / (1.0 + np.exp(-(time - 34.0) / 3.0)))
  disturbance = params['disturbance'] + slow_current + gust + pulse + noise
  return float(t_const), float(gain), float(disturbance)


def heading_reward(
  previous_error: float,
  error: float,
  yaw_rate: float,
  rudder: float,
  rudder_step: float,
  fallback: bool,
  pid_candidate: float,
) -> float:
  progress = abs(previous_error) - abs(error)
  wrong_direction_penalty = 3.5 if abs(previous_error) > 5.0 and np.sign(rudder) != np.sign(previous_error) else 0.0
  crossing_penalty = 5.0 if previous_error * error < 0.0 and abs(error) > 2.0 else 0.0
  overdrive = max(0.0, abs(rudder) - abs(pid_candidate) - 3.0)
  overdrive_penalty = 0.12 * overdrive**2
  settled_bonus = 3.0 if abs(error) < 1.2 and abs(yaw_rate) < 0.12 and abs(rudder) < 6.0 else 0.0
  safety_penalty = 8.0 if fallback else 0.0
  return float(
    1.65 * progress
    -0.044 * error**2
    -0.075 * yaw_rate**2
    -0.0085 * rudder**2
    -0.075 * rudder_step**2
    -wrong_direction_penalty
    -crossing_penalty
    -overdrive_penalty
    -safety_penalty
    + settled_bonus
  )


def scheduler_reward(error: float, yaw_rate: float, rudder: float, rudder_step: float, profile_switch: bool) -> float:
  switch_penalty = 0.12 if profile_switch else 0.0
  return float(
    -0.095 * error**2
    -0.08 * yaw_rate**2
    -0.004 * rudder**2
    -0.07 * rudder_step**2
    -switch_penalty
    + (2.8 if abs(error) < 1.2 and abs(yaw_rate) < 0.12 and abs(rudder) < 5.0 else 0.0)
  )


def should_fallback(error: float, yaw_rate: float, proposed_rudder: float, pid_candidate: float) -> bool:
  return (
    abs(proposed_rudder) > 0.92 * MAX_DELTA
    or abs(yaw_rate) > 4.2
    or (abs(error) < 4.0 and abs(yaw_rate) > 0.8)
    or (abs(error) > 10.0 and abs(proposed_rudder) < 0.85 * abs(pid_candidate))
    or (abs(error) > 5.0 and abs(pid_candidate - proposed_rudder) > 8.0)
    or (abs(error) > 18.0 and np.sign(proposed_rudder) != np.sign(pid_candidate))
  )


def run_heading_episode(
  rng: np.random.Generator,
  q_table: np.ndarray,
  epsilon: float,
  train: bool,
  safety_shell: bool,
  params: dict | None = None,
) -> dict:
  if params is None:
    turn_sign = float(rng.choice([-1.0, 1.0]))
    params = {
      'target': turn_sign * float(rng.uniform(16.0, 34.0)),
      'heading': float(rng.uniform(-10.0, 12.0)),
      'yaw_rate': float(rng.normal(0.0, 0.24)),
      't_const': float(rng.uniform(8.5, 13.8)),
      'gain': float(rng.uniform(0.09, 0.15)),
      'disturbance': float(rng.uniform(-0.10, 0.14)),
      'edge_scenario': True,
    }
  heading = params['heading']
  yaw_rate = params['yaw_rate']
  rudder = 0.0
  alpha = 0.16
  gamma = 0.94
  total_reward = 0.0
  fallback_count = 0
  trace = {
    'time': [],
    'target': [],
    'heading': [],
    'error': [],
    'yaw_rate': [],
    'rudder': [],
    'fallback': [],
  }

  for step in range(120):
    time = step * DT
    target = target_at(params, time)
    t_const, gain, disturbance = edge_environment(params, time, step, rng)
    error = wrap_degrees(target - heading)
    state = heading_state_index(error, yaw_rate, rudder, disturbance)
    if train and rng.random() < epsilon:
      action_idx = int(rng.integers(0, len(HEADING_ACTIONS)))
    else:
      action_idx = int(np.argmax(q_table[state]))

    proposed = float(np.clip(rudder + HEADING_ACTIONS[action_idx], -MAX_DELTA, MAX_DELTA))
    pid_candidate = pid_rudder(error, yaw_rate, rudder)
    fallback = safety_shell and should_fallback(error, yaw_rate, proposed, pid_candidate)
    next_rudder = pid_candidate if fallback else proposed
    fallback_count += int(fallback)
    rudder_step = next_rudder - rudder
    next_heading, next_yaw_rate = nomoto_step(
      heading,
      yaw_rate,
      next_rudder,
      t_const,
      gain,
      disturbance,
    )
    next_error = wrap_degrees(target - next_heading)
    reward = heading_reward(error, next_error, next_yaw_rate, next_rudder, rudder_step, fallback, pid_candidate)

    if train:
      next_state = heading_state_index(next_error, next_yaw_rate, next_rudder, disturbance)
      q_table[state + (action_idx,)] += alpha * (
        reward + gamma * np.max(q_table[next_state]) - q_table[state + (action_idx,)]
      )

    total_reward += reward
    trace['time'].append(time)
    trace['target'].append(target)
    trace['heading'].append(float(next_heading))
    trace['error'].append(next_error)
    trace['yaw_rate'].append(float(next_yaw_rate))
    trace['rudder'].append(float(next_rudder))
    trace['fallback'].append(int(fallback))
    heading = next_heading
    yaw_rate = next_yaw_rate
    rudder = next_rudder

  return {'total_reward': total_reward, 'fallback_count': fallback_count, 'trace': trace}


def train_heading_policy(rng: np.random.Generator) -> dict:
  q_table = np.zeros(heading_state_shape() + (len(HEADING_ACTIONS),))
  rewards: list[float] = []
  fallbacks: list[int] = []
  for episode in range(5000):
    epsilon = max(0.03, 0.48 * (1.0 - episode / 5000))
    result = run_heading_episode(rng, q_table, epsilon, train=True, safety_shell=False)
    rewards.append(float(result['total_reward']))
    if episode % 4 == 0:
      shell_probe = run_heading_episode(rng, q_table, 0.0, train=False, safety_shell=True)
      fallback_count = int(shell_probe['fallback_count'])
    fallbacks.append(fallback_count)
  return {
    'q': q_table,
    'episode_rewards': rewards,
    'episode_fallbacks': fallbacks,
    'moving_average_30': moving_average(rewards, 30).tolist(),
    'fallback_average_30': moving_average(fallbacks, 30).tolist(),
  }


def target_at(params: dict, time: float) -> float:
  schedule = params.get('target_schedule')
  if schedule is None:
    return float(params['target'])
  target = float(schedule[0][1])
  for start_time, value in schedule:
    if time >= float(start_time):
      target = float(value)
    else:
      break
  return target


def run_pid_episode(rng: np.random.Generator, params: dict) -> dict:
  heading = params['heading']
  yaw_rate = params['yaw_rate']
  rudder = 0.0
  trace = {
    'time': [],
    'target': [],
    'heading': [],
    'error': [],
    'yaw_rate': [],
    'rudder': [],
    'fallback': [],
  }
  for step in range(120):
    time = step * DT
    target = target_at(params, time)
    t_const, gain, disturbance = edge_environment(params, time, step, rng)
    error = wrap_degrees(target - heading)
    rudder = pid_rudder(error, yaw_rate, rudder)
    heading, yaw_rate = nomoto_step(heading, yaw_rate, rudder, t_const, gain, disturbance)
    trace['time'].append(time)
    trace['target'].append(target)
    trace['heading'].append(float(heading))
    trace['error'].append(wrap_degrees(target - heading))
    trace['yaw_rate'].append(float(yaw_rate))
    trace['rudder'].append(float(rudder))
    trace['fallback'].append(0)
  return {'trace': trace, 'fallback_count': 0}


def run_rl_pid_episode(
  rng: np.random.Generator,
  q_table: np.ndarray,
  epsilon: float,
  train: bool,
  params: dict | None = None,
) -> dict:
  if params is None:
    params = {
      'target_schedule': [(0.0, float(rng.uniform(18.0, 34.0)))],
      'heading': float(rng.uniform(-8.0, 10.0)),
      'yaw_rate': float(rng.normal(0.0, 0.22)),
      't_const': float(rng.uniform(8.5, 13.5)),
      'gain': float(rng.uniform(0.09, 0.15)),
      'disturbance': float(rng.uniform(-0.08, 0.12)),
      'edge_scenario': True,
    }

  heading = params['heading']
  yaw_rate = params['yaw_rate']
  rudder = 0.0
  prev_profile_idx = 1
  alpha = 0.14
  gamma = 0.94
  total_reward = 0.0
  trace = {
    'time': [],
    'target': [],
    'heading': [],
    'error': [],
    'yaw_rate': [],
    'rudder': [],
    'fallback': [],
    'pid_profile': [],
  }

  for step in range(120):
    time = step * DT
    target = target_at(params, time)
    t_const, gain, disturbance = edge_environment(params, time, step, rng)
    error = wrap_degrees(target - heading)
    state = scheduler_state_index(error, yaw_rate, rudder, disturbance)
    if train and rng.random() < epsilon:
      profile_idx = int(rng.integers(0, len(PID_GAIN_PROFILES)))
    else:
      profile_idx = int(np.argmax(q_table[state]))

    next_rudder = pid_rudder(error, yaw_rate, rudder, PID_GAIN_PROFILES[profile_idx])
    rudder_step = next_rudder - rudder
    next_heading, next_yaw_rate = nomoto_step(heading, yaw_rate, next_rudder, t_const, gain, disturbance)
    next_error = wrap_degrees(target - next_heading)
    reward = scheduler_reward(next_error, next_yaw_rate, next_rudder, rudder_step, profile_idx != prev_profile_idx)

    if train:
      next_state = scheduler_state_index(next_error, next_yaw_rate, next_rudder, disturbance)
      q_table[state + (profile_idx,)] += alpha * (
        reward + gamma * np.max(q_table[next_state]) - q_table[state + (profile_idx,)]
      )

    total_reward += reward
    trace['time'].append(time)
    trace['target'].append(target)
    trace['heading'].append(float(next_heading))
    trace['error'].append(next_error)
    trace['yaw_rate'].append(float(next_yaw_rate))
    trace['rudder'].append(float(next_rudder))
    trace['fallback'].append(0)
    trace['pid_profile'].append(PID_GAIN_PROFILES[profile_idx]['name'])
    heading = next_heading
    yaw_rate = next_yaw_rate
    rudder = next_rudder
    prev_profile_idx = profile_idx

  return {'total_reward': total_reward, 'fallback_count': 0, 'trace': trace}


def train_pid_scheduler(rng: np.random.Generator) -> dict:
  q_table = np.zeros(scheduler_state_shape() + (len(PID_GAIN_PROFILES),))
  rewards: list[float] = []
  for episode in range(2200):
    epsilon = max(0.025, 0.46 * (1.0 - episode / 2200))
    result = run_rl_pid_episode(rng, q_table, epsilon, train=True)
    rewards.append(float(result['total_reward']))
  return {
    'q': q_table,
    'episode_rewards': rewards,
    'moving_average_30': moving_average(rewards, 30).tolist(),
  }


def heading_metrics(trace: dict) -> dict:
  error = np.asarray(trace['error'])
  rudder = np.asarray(trace['rudder'])
  time = np.asarray(trace['time'])
  target = float(trace['target'][0])
  heading = np.asarray(trace['heading'])
  final_band = np.abs(error) <= 1.5
  settling_time = float(time[-1])
  for idx in range(len(final_band)):
    if final_band[idx] and np.all(final_band[idx:]):
      settling_time = float(time[idx])
      break
  overshoot = float(max(0.0, np.max((heading - target) * np.sign(target - trace['heading'][0]))))
  rudder_rate = np.diff(rudder, prepend=rudder[0]) / DT
  return {
    'rms_heading_error_deg': float(np.sqrt(np.mean(error**2))),
    'max_overshoot_deg': overshoot,
    'settling_time_s': settling_time,
    'mean_abs_rudder_deg': float(np.mean(np.abs(rudder))),
    'mean_abs_rudder_rate_deg_s': float(np.mean(np.abs(rudder_rate))),
    'safety_fallback_count': int(np.sum(trace['fallback'])),
  }


def evaluate_heading_controllers(
  rng: np.random.Generator,
  q_table: np.ndarray,
  scheduler_q_table: np.ndarray,
) -> dict:
  disturbance_noise = rng.normal(0.0, 0.012, 120).tolist()
  params = {
    'target_schedule': [(0.0, 25.0)],
    'heading': 4.0,
    'yaw_rate': 0.0,
    't_const': 10.5,
    'gain': 0.118,
    'disturbance': 0.10,
    'edge_scenario': True,
    'disturbance_noise': disturbance_noise,
  }
  pid = run_pid_episode(rng, dict(params))
  rl_direct = run_heading_episode(rng, q_table, 0.0, train=False, safety_shell=False, params=dict(params))
  rl_safe = run_heading_episode(rng, q_table, 0.0, train=False, safety_shell=True, params=dict(params))
  rl_pid = run_rl_pid_episode(rng, scheduler_q_table, 0.0, train=False, params=dict(params))
  traces = {
    'pid': pid['trace'],
    'rl_direct': rl_direct['trace'],
    'rl_safe': rl_safe['trace'],
    'rl_pid_scheduler': rl_pid['trace'],
  }
  summary = {name: heading_metrics(trace) for name, trace in traces.items()}
  return {'summary': summary, 'traces': traces}


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


def plot_heading_training(training: dict, scheduler_training: dict, output: Path) -> None:
  fig, axes = plt.subplots(1, 3, figsize=(14.4, 4.2), constrained_layout=True)
  ax = axes[0]
  ma = np.asarray(training['moving_average_30'])
  ax.plot(np.arange(len(ma)) + 30, ma, color='#2f6f9f', linewidth=2.1)
  ax.set_title('直接控舵策略训练回报')
  ax.set_xlabel('训练轮次')
  ax.set_ylabel('30轮平均累计回报')
  ax.grid(True, alpha=0.24)

  ax = axes[1]
  fallback_ma = np.asarray(training['fallback_average_30'])
  ax.plot(np.arange(len(fallback_ma)) + 30, fallback_ma, color='#b45b35', linewidth=2.1)
  ax.set_title('安全外壳触发次数')
  ax.set_xlabel('训练轮次')
  ax.set_ylabel('30轮平均触发次数')
  ax.grid(True, alpha=0.24)

  ax = axes[2]
  scheduler_ma = np.asarray(scheduler_training['moving_average_30'])
  ax.plot(np.arange(len(scheduler_ma)) + 30, scheduler_ma, color='#2f7d4f', linewidth=2.1)
  ax.set_title('RL调度PID训练回报')
  ax.set_xlabel('训练轮次')
  ax.set_ylabel('30轮平均累计回报')
  ax.grid(True, alpha=0.24)
  fig.savefig(output, bbox_inches='tight')
  plt.close(fig)


def plot_heading_evaluation(evaluation: dict, output: Path) -> None:
  fig, axes = plt.subplots(2, 2, figsize=(11.4, 7.6), constrained_layout=True)
  labels = {
    'pid': 'PID控舵',
    'rl_direct': 'RL直接控舵',
    'rl_safe': 'RL+安全外壳',
    'rl_pid_scheduler': 'RL调度PID',
  }
  colors = {
    'pid': '#d98b2b',
    'rl_direct': '#5b6fa3',
    'rl_safe': '#2f7d4f',
    'rl_pid_scheduler': '#8a5aa6',
  }

  ax = axes[0, 0]
  for name, trace in evaluation['traces'].items():
    ax.plot(trace['time'], trace['heading'], color=colors[name], linewidth=2.0, label=labels[name])
  target = evaluation['traces']['pid']['target'][0]
  ax.axhline(target, color='#333333', linestyle='--', linewidth=1.0, label='目标航向')
  ax.set_title('航向响应')
  ax.set_xlabel('时间 / s')
  ax.set_ylabel('航向 / deg')
  ax.grid(True, alpha=0.24)
  ax.legend(frameon=False)

  ax = axes[0, 1]
  for name, trace in evaluation['traces'].items():
    ax.plot(trace['time'], trace['rudder'], color=colors[name], linewidth=2.0, label=labels[name])
  ax.axhline(MAX_DELTA, color='#b13c3c', linestyle='--', linewidth=0.9)
  ax.axhline(-MAX_DELTA, color='#b13c3c', linestyle='--', linewidth=0.9)
  ax.set_title('舵角输出')
  ax.set_xlabel('时间 / s')
  ax.set_ylabel('舵角 / deg')
  ax.grid(True, alpha=0.24)

  ax = axes[1, 0]
  names = list(labels)
  x = np.arange(len(names))
  width = 0.34
  ax.bar(
    x - width / 2,
    [evaluation['summary'][name]['rms_heading_error_deg'] for name in names],
    width=width,
    color=[colors[name] for name in names],
    alpha=0.9,
    label='RMS误差',
  )
  ax.bar(
    x + width / 2,
    [evaluation['summary'][name]['max_overshoot_deg'] for name in names],
    width=width,
    color=[colors[name] for name in names],
    alpha=0.45,
    label='最大超调',
  )
  ax.set_xticks(x, [labels[name] for name in names])
  ax.set_title('误差与超调')
  ax.set_ylabel('deg')
  ax.grid(axis='y', alpha=0.22)
  ax.legend(frameon=False)

  ax = axes[1, 1]
  ax.bar(
    x - width / 2,
    [evaluation['summary'][name]['mean_abs_rudder_rate_deg_s'] for name in names],
    width=width,
    color=[colors[name] for name in names],
    alpha=0.9,
    label='平均舵速',
  )
  ax.bar(
    x + width / 2,
    [evaluation['summary'][name]['safety_fallback_count'] for name in names],
    width=width,
    color=[colors[name] for name in names],
    alpha=0.45,
    label='安全退化次数',
  )
  ax.set_xticks(x, [labels[name] for name in names])
  ax.set_title('舵角变化与安全外壳')
  ax.grid(axis='y', alpha=0.22)
  ax.legend(frameon=False)
  fig.savefig(output, bbox_inches='tight')
  plt.close(fig)


def main() -> None:
  configure_fonts()
  toy_rng = np.random.default_rng(SEED)
  direct_rng = np.random.default_rng(DIRECT_RL_SEED)
  scheduler_rng = np.random.default_rng(SCHEDULER_RL_SEED)
  evaluation_rng = np.random.default_rng(EVALUATION_SEED)
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

  toy = run_toy_q_learning(toy_rng)
  heading_training = train_heading_policy(direct_rng)
  scheduler_training = train_pid_scheduler(scheduler_rng)
  heading_evaluation = evaluate_heading_controllers(evaluation_rng, heading_training['q'], scheduler_training['q'])

  metrics = {
    'seeds': {
      'toy': SEED,
      'direct_rl': DIRECT_RL_SEED,
      'rl_pid_scheduler': SCHEDULER_RL_SEED,
      'evaluation': EVALUATION_SEED,
    },
    'toy': {
      'learned_final_abs_error': toy['learned_rollout']['final_abs_error'],
      'proportional_final_abs_error': toy['proportional_rollout']['final_abs_error'],
      'random_final_abs_error': toy['random_rollout']['final_abs_error'],
      'learned_total_reward': toy['learned_rollout']['total_reward'],
      'proportional_total_reward': toy['proportional_rollout']['total_reward'],
      'random_total_reward': toy['random_rollout']['total_reward'],
    },
    'heading_control': {
      'training_reward_moving_average': heading_training['moving_average_30'],
      'training_safety_fallback_moving_average': heading_training['fallback_average_30'],
      'scheduler_training_reward_moving_average': scheduler_training['moving_average_30'],
      'pid_gain_profiles': PID_GAIN_PROFILES,
      'evaluation': heading_evaluation['summary'],
    },
  }
  (DATA_DIR / '5-5-rl-policy-simulation.json').write_text(
    json.dumps(metrics, ensure_ascii=False, indent=2),
    encoding='utf-8',
  )
  (DATA_DIR / '5-5-heading-control-trace.json').write_text(
    json.dumps(heading_evaluation['traces'], ensure_ascii=False, indent=2),
    encoding='utf-8',
  )

  plot_toy_demo(toy, PROCESSED_DIR / '5-5-rl-toy-demo.png')
  plot_heading_training(heading_training, scheduler_training, PROCESSED_DIR / '5-5-rl-heading-control-training.png')
  plot_heading_evaluation(heading_evaluation, PROCESSED_DIR / '5-5-rl-heading-control-evaluation.png')


if __name__ == '__main__':
  main()
