pkg load control;
pkg load optim;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "4-4-optimization-data.json");

if exist(out_dir, "dir") ~= 7
  mkdir(out_dir);
endif

function out = response_to_struct(t, y)
  out = struct();
  out.t = t(:)';
  out.y = y(:)';
endfunction

function out = freqresp_to_struct(sys, omega)
  resp = squeeze(freqresp(sys, omega));
  out = struct();
  out.w = omega(:)';
  out.mag = abs(resp(:))';
  out.mag_db = (20 * log10(abs(resp(:))))';
  out.phase_deg = (unwrap(angle(resp(:)))' * 180 / pi);
endfunction

function controller = heading_controller_from_x(x)
  s = tf("s");
  x = x(:);
  controller = x(1) * ((x(2) * s + 1) / (x(3) * x(2) * s + 1));
endfunction

function text = heading_controller_tex(prefix, x)
  x = x(:);
  text = sprintf(
    "%s(s)=%.4f(%.4fs+1)/(%.4fs+1)",
    prefix,
    x(1),
    x(2),
    x(2) * x(3)
  );
endfunction

function out = vector_to_struct(x)
  x = x(:);
  out = struct();
  out.K = x(1);
  out.T = x(2);
  out.alpha = x(3);
  out.alphaT = x(2) * x(3);
endfunction

function metrics = collect_heading_metrics(controller, plant, t)
  closed_loop = feedback(controller * plant, 1);
  control_loop = feedback(controller, plant);

  [y, t_out] = step(closed_loop, t);
  [u, ~] = step(control_loop, t);

  y = y(:);
  u = u(:);
  t_out = t_out(:);
  final_value = y(end);
  overshoot = max(0, (max(y) - final_value) / max(abs(final_value), 1e-12) * 100);

  idx = find(abs(y - final_value) > 0.02 * max(abs(final_value), 1e-12), 1, "last");
  if isempty(idx)
    settling_time = 0;
  elseif idx >= length(t_out)
    settling_time = t_out(end);
  else
    settling_time = t_out(idx + 1);
  endif

  error_signal = 1 - y;
  itae = trapz(t_out, t_out .* abs(error_signal));
  itse = trapz(t_out, t_out .* (error_signal .^ 2));
  control_energy = trapz(t_out, u .^ 2);
  [gm, pm, wg, wc] = margin(controller * plant);

  metrics = struct();
  metrics.final_value = final_value;
  metrics.overshoot = overshoot;
  metrics.settling_time = settling_time;
  metrics.itae = itae;
  metrics.itse = itse;
  metrics.control_energy = control_energy;
  metrics.control_peak = max(abs(u));
  metrics.phase_margin = pm;
  metrics.gain_margin = gm;
  metrics.crossover = wc;
  metrics.phase_cross = wg;
endfunction

function penalty = heading_constraint_penalty(metrics, thresholds)
  penalty = ...
    50 * max(0, metrics.overshoot - thresholds.overshoot) ^ 2 + ...
    20 * max(0, metrics.control_peak - thresholds.control_peak) ^ 2 + ...
    5 * max(0, thresholds.phase_margin - metrics.phase_margin) ^ 2;
endfunction

function [score, metrics] = heading_cost(x, plant, t, weights, refs, thresholds)
  controller = heading_controller_from_x(x);
  metrics = collect_heading_metrics(controller, plant, t);
  score = ...
    weights(1) * (metrics.settling_time / refs.settling_time_target) + ...
    weights(2) * (metrics.overshoot / refs.overshoot_target) + ...
    weights(3) * (metrics.itae / refs.itae_ref) + ...
    weights(4) * (metrics.control_energy / refs.control_energy_ref) + ...
    heading_constraint_penalty(metrics, thresholds);
endfunction

function value = heading_objective(x, plant, t, weights, refs, thresholds)
  [value, ~] = heading_cost(x, plant, t, weights, refs, thresholds);
endfunction

function penalty = bound_penalty(x, lb, ub)
  x = x(:);
  lb = lb(:);
  ub = ub(:);
  under = max(0, lb - x);
  over = max(0, x - ub);
  penalty = 200 * sum((under + over) .^ 2);
endfunction

function [score, metrics] = heading_unconstrained_cost(x, plant, t, weights, refs, lb, ub)
  controller = heading_controller_from_x(x);
  metrics = collect_heading_metrics(controller, plant, t);
  score = ...
    weights(1) * (metrics.settling_time / refs.settling_time_target) + ...
    weights(2) * (metrics.itae / refs.itae_ref) + ...
    weights(3) * (metrics.itse / refs.itse_ref) + ...
    weights(4) * (metrics.control_energy / refs.control_energy_ref) + ...
    bound_penalty(x, lb, ub);
endfunction

function value = heading_unconstrained_objective(x, plant, t, weights, refs, lb, ub)
  [value, ~] = heading_unconstrained_cost(x, plant, t, weights, refs, lb, ub);
endfunction

function out = heading_payload(label, x, plant, t, omega)
  controller = heading_controller_from_x(x);
  closed_loop = feedback(controller * plant, 1);
  control_loop = feedback(controller, plant);

  out = struct();
  out.label = label;
  out.parameters = vector_to_struct(x);
  out.controller_tex = heading_controller_tex("C", x);
  out.response = response_to_struct(t, step(closed_loop, t));
  out.control = response_to_struct(t, step(control_loop, t));
  out.open_loop = freqresp_to_struct(controller * plant, omega);
  out.metrics = collect_heading_metrics(controller, plant, t);
endfunction

function flag = heading_metrics_feasible(metrics, thresholds)
  flag = ...
    metrics.overshoot <= thresholds.overshoot && ...
    metrics.control_peak <= thresholds.control_peak && ...
    metrics.phase_margin >= thresholds.phase_margin;
endfunction

function entry = heading_solution_entry(label, case_id, weights, x_opt, plant, t, omega, score, cvg, iterations)
  entry = heading_payload(label, x_opt, plant, t, omega);
  entry.case_id = case_id;
  entry.weights = weights;
  entry.weights_label = sprintf("[%.2f, %.2f, %.2f, %.2f]", weights(1), weights(2), weights(3), weights(4));
  entry.score = score;
  entry.cvg = cvg;
  entry.iterations = iterations;
endfunction

function controller = roll_controller_from_gain(k)
  s = tf("s");
  controller = k * (2.052 * s ^ 2 + 0.3929 * s + 1) / s;
endfunction

function metrics = collect_roll_metrics(controller, plant, sensor, disturbance, t, omega)
  closed_loop = feedback(plant, sensor * controller);
  control_loop = minreal(controller * sensor * closed_loop);

  y = lsim(closed_loop, disturbance, t);
  u = lsim(control_loop, disturbance, t);
  resp = squeeze(freqresp(closed_loop, omega));
  [peak, idx] = max(abs(resp));

  metrics = struct();
  metrics.output_rms = sqrt(mean(y .^ 2));
  metrics.output_peak = max(abs(y));
  metrics.control_rms = sqrt(mean(u .^ 2));
  metrics.control_peak = max(abs(u));
  metrics.resonance_peak = peak;
  metrics.resonance_peak_db = 20 * log10(peak);
  metrics.resonance_w = omega(idx);
endfunction

function [score, metrics] = roll_cost(k, plant, sensor, disturbance, t, omega, refs, thresholds, weights)
  controller = roll_controller_from_gain(k);
  metrics = collect_roll_metrics(controller, plant, sensor, disturbance, t, omega);
  score = ...
    weights(1) * (metrics.output_rms / refs.output_rms_ref) + ...
    weights(2) * (metrics.resonance_peak / refs.resonance_peak_ref) + ...
    weights(3) * (metrics.control_rms / refs.control_rms_ref);
endfunction

function value = roll_objective(k, plant, sensor, disturbance, t, omega, refs, thresholds, weights)
  [value, ~] = roll_cost(k, plant, sensor, disturbance, t, omega, refs, thresholds, weights);
endfunction

function out = roll_payload(label, k, plant, sensor, disturbance, t, omega)
  controller = roll_controller_from_gain(k);
  closed_loop = feedback(plant, sensor * controller);
  control_loop = minreal(controller * sensor * closed_loop);

  out = struct();
  out.label = label;
  out.parameters = struct("k", k);
  out.controller_tex = sprintf(
    "C_r(s)=%.4f(2.0520s^2+0.3929s+1)/s",
    k
  );
  out.response = response_to_struct(t, lsim(closed_loop, disturbance, t));
  out.control = response_to_struct(t, lsim(control_loop, disturbance, t));
  out.channel = freqresp_to_struct(closed_loop, omega);
  out.metrics = collect_roll_metrics(controller, plant, sensor, disturbance, t, omega);
endfunction

s = tf("s");

ship_plant = 0.01715 / (s * (s + 0.1) * (s + 2.14375));
ship_t = 0:0.1:200;
ship_w = logspace(-3, 1, 500);
x0 = [2.796; 10.0; 0.406];
lb = [1.0; 4.0; 0.15];
ub = [6.0; 15.0; 0.85];

ship_initial = heading_payload("4-3 初始方案", x0, ship_plant, ship_t, ship_w);

ship_refs = struct();
ship_refs.settling_time_target = 40.0;
ship_refs.overshoot_target = 20.0;
ship_refs.itae_ref = ship_initial.metrics.itae;
ship_refs.itse_ref = ship_initial.metrics.itse;
ship_refs.control_energy_ref = ship_initial.metrics.control_energy;

ship_thresholds = struct();
ship_thresholds.overshoot = 20.0;
ship_thresholds.control_peak = 7.0;
ship_thresholds.phase_margin = 45.0;

ship_weight_candidates = [
  0.25, 0.25, 0.25, 0.25;
  0.35, 0.25, 0.20, 0.20;
  0.30, 0.20, 0.20, 0.30
];

ship_opts = optimset(
  "Algorithm", "active-set",
  "MaxIter", 60,
  "TolX", 1e-4,
  "TolFun", 1e-4,
  "Display", "off"
);

ship_scan_entries = {};
ship_scan_scores = [];
for i = 1:rows(ship_weight_candidates)
  weights = ship_weight_candidates(i, :);
  [x_opt, ~, cvg, outp] = fmincon(
    @(x) heading_objective(x, ship_plant, ship_t, weights, ship_refs, ship_thresholds),
    x0,
    [],
    [],
    [],
    [],
    lb,
    ub,
    [],
    ship_opts
  );

  [score, metrics] = heading_cost(x_opt, ship_plant, ship_t, weights, ship_refs, ship_thresholds);
  entry = struct();
  entry.rank_hint = i;
  entry.weights = weights;
  entry.weights_label = sprintf("[%.2f, %.2f, %.2f, %.2f]", weights(1), weights(2), weights(3), weights(4));
  entry.parameters = vector_to_struct(x_opt);
  entry.controller_tex = heading_controller_tex("C", x_opt);
  entry.metrics = metrics;
  entry.score = score;
  entry.feasible = heading_metrics_feasible(metrics, ship_thresholds);
  entry.cvg = cvg;
  if isfield(outp, "iterations")
    entry.iterations = outp.iterations;
  elseif isfield(outp, "niter")
    entry.iterations = outp.niter;
  else
    entry.iterations = NaN;
  endif
  ship_scan_entries{end + 1} = entry;
  ship_scan_scores(end + 1) = score;
endfor

[~, ship_order] = sort(ship_scan_scores);
ship_sorted_entries = ship_scan_entries(ship_order);
ship_selected_entry = ship_sorted_entries{1};
ship_selected_x = [
  ship_selected_entry.parameters.K;
  ship_selected_entry.parameters.T;
  ship_selected_entry.parameters.alpha
];
ship_optimized = heading_payload("4-4 优化方案", ship_selected_x, ship_plant, ship_t, ship_w);

ship_trial_defs = {
  struct("id", "baseline", "label", "比例基线", "diagnosis", "速度慢且超调偏大", "controller_tex", "C(s)=2.25", "tf", 2.25),
  struct("id", "lf_only", "label", "仅补低频", "diagnosis", "低频补偿后动态矛盾更突出", "controller_tex", "C(s)=1.5(2s+1)/(6s+1)", "tf", 1.5 * (2 * s + 1) / (6 * s + 1)),
  struct("id", "aggressive", "label", "方向过激", "diagnosis", "速度改善明显但控制峰值先越界", "controller_tex", "C(s)=5(10s+1)/(2s+1)", "tf", 5 * (10 * s + 1) / (2 * s + 1)),
  struct("id", "repair", "label", "最小修正", "diagnosis", "控制峰值压回后仍留有超调与裕度缺口", "controller_tex", "C(s)=3(10s+1)/(5s+1)", "tf", 3 * (10 * s + 1) / (5 * s + 1))
};
ship_classical_trials = {};
for i = 1:numel(ship_trial_defs)
  item = ship_trial_defs{i};
  metrics = collect_heading_metrics(item.tf, ship_plant, ship_t);
  trial = struct();
  trial.id = item.id;
  trial.label = item.label;
  trial.diagnosis = item.diagnosis;
  trial.controller_tex = item.controller_tex;
  trial.metrics = metrics;
  trial.hard_feasible = heading_metrics_feasible(metrics, ship_thresholds);
  ship_classical_trials{end + 1} = trial;
endfor

ship_top_entries = {};
for i = 1:min(3, numel(ship_sorted_entries))
  ship_top_entries{end + 1} = ship_sorted_entries{i};
endfor

ship_unconstrained_weights = [
  0.40, 0.30, 0.20, 0.10;
  0.30, 0.30, 0.20, 0.20;
  0.20, 0.25, 0.25, 0.30
];
ship_unconstrained_case_ids = {"speed_first", "balanced", "energy_first"};
ship_unconstrained_labels = {"速度优先无约束方案", "平衡偏好无约束方案", "动作代价优先无约束方案"};
ship_unconstrained_entries = {};
ship_unconstrained_opts = optimset(
  "MaxIter", 80,
  "TolX", 1e-4,
  "TolFun", 1e-4,
  "Display", "off"
);
ship_seed = x0;
for i = 1:rows(ship_unconstrained_weights)
  weights = ship_unconstrained_weights(i, :);
  [x_opt, fval, cvg, outp] = fminsearch(
    @(x) heading_unconstrained_objective(x, ship_plant, ship_t, weights, ship_refs, lb, ub),
    ship_seed,
    ship_unconstrained_opts
  );
  [score, ~] = heading_unconstrained_cost(x_opt, ship_plant, ship_t, weights, ship_refs, lb, ub);
  if isfield(outp, "iterations")
    iterations = outp.iterations;
  elseif isfield(outp, "niter")
    iterations = outp.niter;
  else
    iterations = NaN;
  endif
  entry = heading_solution_entry(
    ship_unconstrained_labels{i},
    ship_unconstrained_case_ids{i},
    weights,
    x_opt,
    ship_plant,
    ship_t,
    ship_w,
    score,
    cvg,
    iterations
  );
  entry.raw_objective = fval;
  ship_unconstrained_entries{end + 1} = entry;
  ship_seed = x_opt;
endfor

ship_pareto_weights = linspace(0, 1, 11);
ship_pareto_entries_all = {};
ship_pareto_seed = x0;
for i = 1:numel(ship_pareto_weights)
  lambda = ship_pareto_weights(i);
  weights = [0, lambda, 0, 1 - lambda];
  [x_opt, fval, cvg, outp] = fminsearch(
    @(x) heading_unconstrained_objective(x, ship_plant, ship_t, weights, ship_refs, lb, ub),
    ship_pareto_seed,
    ship_unconstrained_opts
  );
  [score, ~] = heading_unconstrained_cost(x_opt, ship_plant, ship_t, weights, ship_refs, lb, ub);
  if isfield(outp, "iterations")
    iterations = outp.iterations;
  elseif isfield(outp, "niter")
    iterations = outp.niter;
  else
    iterations = NaN;
  endif
  entry = heading_solution_entry(
    sprintf("Pareto 候选 %.2f", lambda),
    sprintf("pareto_%02d", i),
    weights,
    x_opt,
    ship_plant,
    ship_t,
    ship_w,
    score,
    cvg,
    iterations
  );
  entry.pareto_lambda = lambda;
  entry.raw_objective = fval;
  ship_pareto_entries_all{end + 1} = entry;
  ship_pareto_seed = x_opt;
endfor

ship_pareto_front = {};
for i = 1:numel(ship_pareto_entries_all)
  current = ship_pareto_entries_all{i};
  dominated = false;
  for j = 1:numel(ship_pareto_entries_all)
    if i == j
      continue;
    endif
    other = ship_pareto_entries_all{j};
    if ...
      other.metrics.itae <= current.metrics.itae && ...
      other.metrics.control_energy <= current.metrics.control_energy && ...
      (other.metrics.itae < current.metrics.itae || other.metrics.control_energy < current.metrics.control_energy)
      dominated = true;
      break;
    endif
  endfor
  if !dominated
    ship_pareto_front{end + 1} = current;
  endif
endfor

pareto_itae = zeros(1, numel(ship_pareto_front));
for i = 1:numel(ship_pareto_front)
  pareto_itae(i) = ship_pareto_front{i}.metrics.itae;
endfor
[~, pareto_order] = sort(pareto_itae);
ship_pareto_front = ship_pareto_front(pareto_order);

ship_pareto_front_bounded = {};
for i = 1:numel(ship_pareto_front)
  params = ship_pareto_front{i}.parameters;
  x_candidate = [params.K; params.T; params.alpha];
  if all(x_candidate >= lb - 1e-6) && all(x_candidate <= ub + 1e-6)
    ship_pareto_front_bounded{end + 1} = ship_pareto_front{i};
  endif
endfor
ship_pareto_front = ship_pareto_front_bounded;

ship_pareto_examples = {};
if !isempty(ship_pareto_front)
  example_indices = unique([1, ceil(numel(ship_pareto_front) / 2), numel(ship_pareto_front)]);
  example_labels = {"快速端", "中间点", "节能端"};
  for k = 1:numel(example_indices)
    entry = ship_pareto_front{example_indices(k)};
    entry.example_label = example_labels{k};
    ship_pareto_examples{end + 1} = entry;
  endfor
endif

ship_normalization_refs = {
  struct("name", "t_s/40", "value", ship_refs.settling_time_target, "source", "40 s 来自客船航向保持任务书中的速度目标，用于把调节时间写成软目标。"),
  struct("name", "M_p/20", "value", ship_refs.overshoot_target, "source", "20%% 来自舒适性边界。该值既作为归一化基准，也作为硬约束阈值。"),
  struct("name", "ITAE/ITAE_0", "value", ship_refs.itae_ref, "source", "ITAE_0 取自 4-3 初始方案仿真结果，用来衡量累计拖尾相对起点的改善幅度。"),
  struct("name", "E_u/E_{u,0}", "value", ship_refs.control_energy_ref, "source", "控制能量基准取自 4-3 初始方案仿真结果，使控制代价与动态指标可同比较。")
};

ship_parameter_bounds = {
  struct("name", "K", "lower", lb(1), "upper", ub(1), "reason", "在本对象上，K<1 时速度改善有限；K>6 时首轮试验会迅速推高控制峰值，难以保持舵角边界。"),
  struct("name", "T", "lower", lb(2), "upper", ub(2), "reason", "T 控制超前零点所在频段。下界避免零点过高而错过主工作频段，上界避免零点过低而退化为慢补偿。"),
  struct("name", "alpha", "lower", lb(3), "upper", ub(3), "reason", "alpha 必须保持在 (0,1) 内才是超前结构；下界防止相位补偿过激，上界防止超前作用过弱。")
};

roll_plant = 1 / (2.052 * s ^ 2 + 0.3929 * s + 1);
roll_sensor = s;
roll_t = 0:0.05:80;
roll_w = logspace(-2, 1, 500);
roll_w0 = 0.681816;
roll_disturbance = sin(roll_w0 * roll_t);
roll_initial_k = 1.0;

roll_uncontrolled = struct();
roll_uncontrolled.response = response_to_struct(roll_t, lsim(roll_plant, roll_disturbance, roll_t));
roll_uncontrolled.channel = freqresp_to_struct(roll_plant, roll_w);
roll_initial = roll_payload("初始抗扰起点", roll_initial_k, roll_plant, roll_sensor, roll_disturbance, roll_t, roll_w);

roll_refs = struct();
roll_refs.output_rms_ref = roll_initial.metrics.output_rms;
roll_refs.resonance_peak_ref = roll_initial.metrics.resonance_peak;
roll_refs.control_rms_ref = roll_initial.metrics.control_rms;

roll_thresholds = struct();
roll_thresholds.control_peak = 0.75;

roll_weights = [0.60, 0.25, 0.15];
roll_bounds = [0.5, 3.5];
[roll_k_opt, roll_score] = fminbnd(
  @(k) roll_objective(k, roll_plant, roll_sensor, roll_disturbance, roll_t, roll_w, roll_refs, roll_thresholds, roll_weights),
  roll_bounds(1),
  roll_bounds(2)
);
[roll_final_score, roll_final_metrics] = roll_cost(
  roll_k_opt,
  roll_plant,
  roll_sensor,
  roll_disturbance,
  roll_t,
  roll_w,
  roll_refs,
  roll_thresholds,
  roll_weights
);
roll_optimized = roll_payload("横摇边界优化结果", roll_k_opt, roll_plant, roll_sensor, roll_disturbance, roll_t, roll_w);

payload = struct();
payload.lesson_id = "4-4";
payload.required_packages = {"control", "struct", "datatypes", "statistics", "optim"};
payload.install_commands = {
  "pkg install -forge struct",
  "pkg install -forge datatypes",
  "pkg install -forge statistics",
  "pkg install -forge optim"
};

payload.ship = struct();
payload.ship.plant_tex = "P_h(s)=0.01715/[s(s+0.1)(s+2.14375)]";
payload.ship.structure_tex = "C_h(s)=K(Ts+1)/(\\alpha Ts+1)";
payload.ship.initial = ship_initial;
payload.ship.optimized = ship_optimized;
payload.ship.thresholds = ship_thresholds;
payload.ship.refs = ship_refs;
payload.ship.normalization_refs = ship_normalization_refs;
payload.ship.parameter_bounds = ship_parameter_bounds;
payload.ship.selected_weights = ship_selected_entry.weights;
payload.ship.selected_weights_label = ship_selected_entry.weights_label;
payload.ship.selected_score = ship_selected_entry.score;
payload.ship.weight_scan = ship_sorted_entries;
payload.ship.top_candidates = ship_top_entries;
payload.ship.classical_trials = ship_classical_trials;
payload.ship.classical_trials_feasible = false;
payload.ship.hard_constraints = {
  "M_p <= 20%",
  "max|u(t)| <= 7",
  "phase_margin >= 45 deg"
};
payload.ship.soft_objectives = {
  "在不破硬约束的前提下缩短调节时间",
  "压低 ITAE 以减少误差拖尾",
  "降低控制能量以避免过度动作"
};
payload.ship.integral_index_notes = {
  struct("name", "ITAE", "role", "主代价项", "meaning", "对后期拖尾误差更敏感，适合航向保持这类希望尽快收稳的任务。"),
  struct("name", "ITSE", "role", "复核指标", "meaning", "对误差峰值和中前期偏差更敏感，用来检查结果是否只是拖尾缩短而并未真正压低误差强度。")
};
payload.ship.unconstrained_weight_scan = ship_unconstrained_entries;
payload.ship.pareto_front = ship_pareto_front;
payload.ship.pareto_examples = ship_pareto_examples;

payload.roll = struct();
payload.roll.plant_tex = "P_r(s)=1/(2.052s^2+0.3929s+1)";
payload.roll.structure_tex = "C_r(s)=k(2.052s^2+0.3929s+1)/s";
payload.roll.uncontrolled = roll_uncontrolled;
payload.roll.initial = roll_initial;
payload.roll.optimized = roll_optimized;
payload.roll.refs = roll_refs;
payload.roll.thresholds = roll_thresholds;
payload.roll.weights = roll_weights;
payload.roll.bounds = struct("k_min", roll_bounds(1), "k_max", roll_bounds(2));
payload.roll.selected_score = roll_final_score;
payload.roll.objective_terms = {
  struct("name", "rms(phi)", "role", "软目标", "meaning", "希望整体横摇均方值更低。"),
  struct("name", "peak|T_d(jw)|", "role", "软目标", "meaning", "希望谐振峰更低，避免海浪激励下放大。"),
  struct("name", "rms(u)", "role", "软目标", "meaning", "希望减摇鳍动作更节制。")
};

fid = fopen(out_file, "w");
if fid < 0
  error("Failed to open output file: %s", out_file);
endif
fwrite(fid, jsonencode(payload), "char");
fclose(fid);

printf("Wrote %s\n", out_file);
