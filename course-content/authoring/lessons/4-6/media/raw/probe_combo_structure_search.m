function probe_combo_structure_search()
  pkg load control;

  args = argv();
  if numel(args) < 2
    error("usage: octave -qf probe_combo_structure_search.m <input.json> <output.json>");
  endif

  input_payload = jsondecode(fileread(args{1}));
  output_path = args{2};
  scenario = scenario_from_config(input_payload.scenario_configs.(input_payload.scenario_id));
  payload = run_search(input_payload, scenario);

  fid = fopen(output_path, "w");
  if fid < 0
    error("failed to open output path: %s", output_path);
  endif
  fputs(fid, jsonencode(payload));
  fclose(fid);
endfunction

function payload = run_search(input_payload, scenario)
  baseline_vector = input_payload.baseline_vector(:)';
  ga_cfg = input_payload.search_config.ga;
  pso_cfg = input_payload.search_config.pso;
  baseline_eval = evaluate_vector(baseline_vector, scenario, true);

  ga_seeds = ga_cfg.seeds(:)';
  ga_runs = struct([]);
  for i = 1:numel(ga_seeds)
    ga_runs(i) = run_ga_search(ga_seeds(i), baseline_vector, scenario, ga_cfg.population, ga_cfg.generations);
  endfor

  pso_seeds = pso_cfg.seeds(:)';
  pso_runs = struct([]);
  for i = 1:numel(pso_seeds)
    pso_runs(i) = run_pso_search(pso_seeds(i), baseline_vector, scenario, pso_cfg.particles, pso_cfg.iters);
  endfor

  all_runs = [ga_runs, pso_runs];
  passed_mask = arrayfun(@(item) logical(item.sanity_passed), all_runs);
  if any(passed_mask)
    passing_runs = all_runs(passed_mask);
    [~, idx] = min(arrayfun(@(item) item.best_cost, passing_runs));
    selected_run = passing_runs(idx);
  else
    [~, idx] = min(arrayfun(@(item) item.best_cost, all_runs));
    selected_run = all_runs(idx);
  endif

  [~, transition_idx] = min(arrayfun(@(item) item.evaluation.metrics.transition_error, all_runs));
  best_transition_run = all_runs(transition_idx);

  selected_solution = solution_snapshot(selected_run, baseline_eval);
  best_transition_candidate = solution_snapshot(best_transition_run, baseline_eval);
  comparison = comparison_to_baseline(baseline_eval, selected_run.evaluation);
  promotion = promotion_decision(comparison);

  payload = struct();
  payload.baseline_evaluation = baseline_eval;
  payload.ga_runs = ga_runs;
  payload.pso_runs = pso_runs;
  payload.selected_solution = selected_solution;
  payload.best_transition_candidate = best_transition_candidate;
  payload.comparison_to_baseline = comparison;
  payload.promotion_decision = promotion;
endfunction

function run_record = run_ga_search(seed, baseline_vector, scenario, population_size, generations)
  rand("seed", seed);
  randn("seed", seed);
  population = seed_population(baseline_vector, population_size);
  history = zeros(1, generations);
  best_z = population(1, :);
  best_eval = struct();

  for iter = 1:generations
    evaluations = evaluate_population(population, scenario, false);
    costs = arrayfun(@(item) item.cost_breakdown.total, evaluations);
    [sorted_costs, order] = sort(costs);
    population = population(order, :);
    evaluations = evaluations(order);
    history(iter) = sorted_costs(1);
    best_z = population(1, :);
    best_eval = evaluations(1);

    elites = population(1:4, :);
    next_population = elites;
    while rows(next_population) < population_size
      parent_a = elites(randi(rows(elites)), :);
      parent_b = elites(randi(rows(elites)), :);
      mask = rand(1, columns(population)) < 0.5;
      child = parent_a;
      child(mask) = parent_b(mask);
      mutation_mask = rand(1, columns(population)) < 0.18;
      if any(mutation_mask)
        child(mutation_mask) = child(mutation_mask) + 0.10 * randn(1, sum(mutation_mask));
      endif
      next_population(end + 1, :) = min(max(child, 0.0), 1.0);
    endwhile
    population = next_population(1:population_size, :);
  endfor

  trace_eval = evaluate_vector(best_z, scenario, true);
  run_record = struct(
    "algorithm", "GA",
    "seed", seed,
    "best_cost", trace_eval.cost_breakdown.total,
    "best_per_iteration", history,
    "sanity_passed", logical(trace_eval.screening.passed),
    "evaluation", trace_eval
  );
endfunction

function run_record = run_pso_search(seed, baseline_vector, scenario, n_particles, iterations)
  rand("seed", seed);
  randn("seed", seed);
  positions = seed_population(baseline_vector, n_particles);
  velocities = 0.05 * randn(n_particles, columns(positions));
  personal_best_positions = positions;
  personal_best_costs = inf(n_particles, 1);
  global_best_position = positions(1, :);
  global_best_cost = inf;
  history = zeros(1, iterations);

  for iter = 1:iterations
    evaluations = evaluate_population(positions, scenario, false);
    costs = arrayfun(@(item) item.cost_breakdown.total, evaluations)';
    improved = costs < personal_best_costs;
    personal_best_positions(improved, :) = positions(improved, :);
    personal_best_costs(improved) = costs(improved);
    [best_cost_here, best_idx] = min(costs);
    if best_cost_here < global_best_cost
      global_best_cost = best_cost_here;
      global_best_position = positions(best_idx, :);
    endif
    history(iter) = global_best_cost;

    r1 = rand(size(positions));
    r2 = rand(size(positions));
    velocities = 0.58 * velocities ...
      + 1.35 * r1 .* (personal_best_positions - positions) ...
      + 1.75 * r2 .* (repmat(global_best_position, n_particles, 1) - positions);
    positions = min(max(positions + velocities, 0.0), 1.0);
  endfor

  trace_eval = evaluate_vector(global_best_position, scenario, true);
  run_record = struct(
    "algorithm", "PSO",
    "seed", seed,
    "best_cost", trace_eval.cost_breakdown.total,
    "best_per_iteration", history,
    "sanity_passed", logical(trace_eval.screening.passed),
    "evaluation", trace_eval
  );
endfunction

function snapshot = solution_snapshot(run_record, baseline_eval)
  comparison = comparison_to_baseline(baseline_eval, run_record.evaluation);
  snapshot = struct(
    "algorithm", run_record.algorithm,
    "seed", run_record.seed,
    "best_cost", run_record.best_cost,
    "z", run_record.evaluation.z,
    "modules", run_record.evaluation.modules,
    "controller_components", run_record.evaluation.controller_components,
    "branch_metrics", run_record.evaluation.branch_metrics,
    "metrics", run_record.evaluation.metrics,
    "screening", run_record.evaluation.screening,
    "cost_breakdown", run_record.evaluation.cost_breakdown,
    "time_response", run_record.evaluation.time_response,
    "trajectory", run_record.evaluation.trajectory,
    "frequency_response", run_record.evaluation.frequency_response,
    "comparison_to_baseline", comparison
  );
endfunction

function comparison = comparison_to_baseline(baseline_eval, candidate_eval)
  base_metrics = baseline_eval.metrics;
  cand_metrics = candidate_eval.metrics;
  base_cost = baseline_eval.cost_breakdown.total;
  cand_cost = candidate_eval.cost_breakdown.total;
  comparison = struct(
    "baseline_total_cost", base_cost,
    "candidate_total_cost", cand_cost,
    "total_cost_delta", base_cost - cand_cost,
    "total_cost_ratio", cand_cost / max(base_cost, 1e-9),
    "transition_error_delta", base_metrics.transition_error - cand_metrics.transition_error,
    "transition_error_ratio", cand_metrics.transition_error / max(base_metrics.transition_error, 1e-9),
    "trajectory_error_delta", base_metrics.trajectory_error - cand_metrics.trajectory_error,
    "trajectory_error_ratio", cand_metrics.trajectory_error / max(base_metrics.trajectory_error, 1e-9),
    "u_max_delta", base_metrics.u_max - cand_metrics.u_max,
    "control_energy_delta", base_metrics.control_energy - cand_metrics.control_energy,
    "M_r_delta", base_metrics.M_r - cand_metrics.M_r,
    "tail_segment_error_delta", base_metrics.tail_segment_error - cand_metrics.tail_segment_error,
    "u_max_within_screening", logical(candidate_eval.screening.u_peak_ok),
    "control_energy_within_screening", logical(candidate_eval.screening.control_energy_ok),
    "M_r_within_screening", logical(candidate_eval.screening.M_r_ok),
    "tail_segment_error_within_screening", logical(candidate_eval.screening.tail_ok),
    "transition_error_within_screening", logical(candidate_eval.screening.transition_ok),
    "trajectory_error_within_screening", logical(candidate_eval.screening.trajectory_ok)
  );
endfunction

function decision = promotion_decision(comparison)
  gate_checks = struct(
    "total_cost_lower", logical(comparison.candidate_total_cost < comparison.baseline_total_cost),
    "transition_error_5pct_better", logical(comparison.transition_error_ratio <= 0.95),
    "trajectory_error_5pct_better", logical(comparison.trajectory_error_ratio <= 0.95),
    "u_max_within_screening", logical(comparison.u_max_within_screening),
    "control_energy_within_screening", logical(comparison.control_energy_within_screening),
    "M_r_within_screening", logical(comparison.M_r_within_screening),
    "tail_segment_error_within_screening", logical(comparison.tail_segment_error_within_screening)
  );
  should_promote = gate_checks.total_cost_lower && gate_checks.transition_error_5pct_better ...
    && gate_checks.trajectory_error_5pct_better && gate_checks.u_max_within_screening ...
    && gate_checks.control_energy_within_screening && gate_checks.M_r_within_screening ...
    && gate_checks.tail_segment_error_within_screening;
  if should_promote
    summary = "满足升级门槛，可并入主实验。";
  else
    summary = "未满足升级门槛，保留主实验，仅记录专项验证结论。";
  endif
  decision = struct("should_promote", logical(should_promote), "gate_checks", gate_checks, "summary", summary);
endfunction

function population = seed_population(baseline_vector, size_needed)
  population = rand(size_needed, numel(baseline_vector));
  population(1, :) = baseline_vector;
  if size_needed >= 2
    population(2, :) = baseline_vector;
    population(2, 7) = 0.56;
    population(2, 11) = 0.78;
  endif
  if size_needed >= 3
    population(3, :) = baseline_vector;
    population(3, 7:10) = [0.88, 0.64, 0.24, 0.30];
  endif
  if size_needed >= 4
    population(4, :) = baseline_vector;
    population(4, 11:13) = [0.92, 0.58, 0.20];
  endif
endfunction

function evaluations = evaluate_population(population, scenario, include_traces)
  evaluations = struct([]);
  for i = 1:rows(population)
    evaluations(i) = evaluate_vector(population(i, :), scenario, include_traces);
  endfor
endfunction

function evaluation = evaluate_vector(z, scenario, include_traces)
  decoded = decode_combo_vector(z);
  evaluation = evaluate_candidate(decoded, scenario, include_traces);
endfunction

function scenario = scenario_from_config(config)
  s = tf("s");
  plant_cfg = config.plant;
  scenario = struct();
  scenario.id = config.id;
  scenario.label = config.label;
  scenario.plant = plant_cfg.gain / (s * (s + plant_cfg.slow_pole) * (s + plant_cfg.fast_pole));
  scenario.omega = logspace(-3, 1, 320)';
  scenario.mission_time = (config.time.start:config.time.step:config.time.stop)';
  scenario.mission_reference = build_reference_profile(scenario.mission_time, config.mission_profile);
  scenario.switch_times = [config.mission_profile(2:end).time];
  scenario.first_target = config.initial_step.target;
  scenario.first_change_time = config.initial_step.segment_end;
  scenario.u_peak_limit = config.actuator.u_peak_limit;
  scenario.control_energy_limit = config.actuator.control_energy_limit;
  scenario.trajectory_speed = config.trajectory_speed;
  scenario.screening = config.screening;
endfunction

function y = build_reference_profile(t, profile)
  y = zeros(size(t));
  for i = 1:numel(profile)
    y(t >= profile(i).time) = profile(i).value;
  endfor
endfunction

function y = scale01(x, lo, hi)
  y = lo + (hi - lo) * x;
endfunction

function decoded = decode_combo_vector(z)
  z = z(:)';
  decoded = struct();
  decoded.z = z;
  decoded.modules = struct();
  decoded.modules.feedback = decode_feedback_module(z(1:6));
  decoded.modules.feedforward = decode_feedforward_module(z(7:10));
  decoded.modules.rate_feedback = decode_rate_feedback_module(z(11:13));
endfunction

function module = decode_feedback_module(z_fb)
  z_fb = z_fb(:)';
  structure_id = max(1, min(5, ceil(5 * z_fb(1))));
  module = struct();
  module.module_id = structure_id;
  module.z = z_fb;
  switch structure_id
    case 1
      module.module_name = "PI";
      module.active_slots = {"z_fb0", "z_fb1", "z_fb2"};
      module.ignored_slots = {"z_fb3", "z_fb4", "z_fb5"};
      module.parameters = struct("K", scale01(z_fb(2), 0.90, 2.20), "Ti", scale01(z_fb(3), 8.00, 28.00));
      module.expression = "C_fb(s)=K(T_i s+1)/(T_i s)";
    case 2
      module.module_name = "超前";
      module.active_slots = {"z_fb0", "z_fb1", "z_fb2", "z_fb3"};
      module.ignored_slots = {"z_fb4", "z_fb5"};
      module.parameters = struct("K", scale01(z_fb(2), 1.00, 2.73), "Tz", scale01(z_fb(3), 8.00, 17.585), "Tp", scale01(z_fb(4), 4.00, 7.33));
      module.expression = "C_fb(s)=K(T_z s+1)/(T_p s+1)";
    case 3
      module.module_name = "PI + 超前";
      module.active_slots = {"z_fb0", "z_fb1", "z_fb2", "z_fb3", "z_fb4"};
      module.ignored_slots = {"z_fb5"};
      module.parameters = struct("K", scale01(z_fb(2), 1.00, 2.20), "Ti", scale01(z_fb(3), 6.00, 48.00), "Tz", scale01(z_fb(4), 5.00, 22.00), "Tp", scale01(z_fb(5), 1.80, 6.00));
      module.expression = "C_fb(s)=K(T_i s+1)/(T_i s)(T_z s+1)/(T_p s+1)";
    case 4
      module.module_name = "滞后 + 超前";
      module.active_slots = {"z_fb0", "z_fb1", "z_fb2", "z_fb3", "z_fb4", "z_fb5"};
      module.ignored_slots = {};
      module.parameters = struct("K", scale01(z_fb(2), 0.90, 2.10), "Tlag", scale01(z_fb(3), 6.00, 18.00), "beta", scale01(z_fb(4), 0.65, 0.96), "Tlead", scale01(z_fb(5), 6.00, 18.00), "Tp", scale01(z_fb(6), 2.50, 6.20));
      module.expression = "C_fb(s)=K(\beta T_{lag}s+1)/(T_{lag}s+1)(T_{lead}s+1)/(T_p s+1)";
    otherwise
      module.module_name = "带微分滤波的 PID";
      module.active_slots = {"z_fb0", "z_fb1", "z_fb2", "z_fb3", "z_fb4"};
      module.ignored_slots = {"z_fb5"};
      module.parameters = struct("Kp", scale01(z_fb(2), 0.90, 2.50), "Ti", scale01(z_fb(3), 8.00, 22.00), "Td", scale01(z_fb(4), 0.50, 3.80), "Tf", scale01(z_fb(5), 0.04, 0.20));
      module.expression = "C_fb(s)=K_p(1+1/(T_i s)+(T_d s)/(T_f s+1))";
  endswitch
endfunction

function module = decode_feedforward_module(z_ff)
  z_ff = z_ff(:)';
  module_id = max(1, min(3, ceil(3 * z_ff(1))));
  module = struct();
  module.module_id = module_id;
  module.z = z_ff;
  switch module_id
    case 1
      module.module_name = "none";
      module.active_slots = {"z_ff0"};
      module.ignored_slots = {"z_ff1", "z_ff2", "z_ff3"};
      module.parameters = struct();
      module.expression = "F_r(s)=0";
    case 2
      T_p = scale01(z_ff(3), 0.10, 2.50);
      rho = scale01(z_ff(4), 1.20, 8.00);
      module.module_name = "lead_ff";
      module.active_slots = {"z_ff0", "z_ff1", "z_ff2", "z_ff3"};
      module.ignored_slots = {};
      module.parameters = struct("K_ff", scale01(z_ff(2), 0.00, 1.20), "T_p", T_p, "rho", rho, "T_z", rho * T_p);
      module.expression = "F_r(s)=K_ff(T_z s+1)/(T_p s+1)";
    otherwise
      module.module_name = "filtered_diff_ff";
      module.active_slots = {"z_ff0", "z_ff1", "z_ff2", "z_ff3"};
      module.ignored_slots = {};
      module.parameters = struct("K_ff", scale01(z_ff(2), 0.00, 1.20), "T_d", scale01(z_ff(3), 0.10, 4.00), "T_f", scale01(z_ff(4), 0.03, 0.30));
      module.expression = "F_r(s)=K_ff T_d s/(T_f s+1)";
  endswitch
endfunction

function module = decode_rate_feedback_module(z_rate)
  z_rate = z_rate(:)';
  module_id = max(1, min(2, ceil(2 * z_rate(1))));
  module = struct();
  module.module_id = module_id;
  module.z = z_rate;
  if module_id == 1
    module.module_name = "none";
    module.active_slots = {"z_rate0"};
    module.ignored_slots = {"z_rate1", "z_rate2"};
    module.parameters = struct();
    module.expression = "u_rate(s)=0";
  else
    module.module_name = "filtered_rate";
    module.active_slots = {"z_rate0", "z_rate1", "z_rate2"};
    module.ignored_slots = {};
    module.parameters = struct("K_r", scale01(z_rate(2), 0.00, 1.80), "T_r", scale01(z_rate(3), 0.02, 0.40));
    module.expression = "u_rate(s)=-K_r/(T_r s+1) * dot(psi)";
  endif
endfunction

function controller = feedback_controller(module)
  s = tf("s");
  p = module.parameters;
  switch module.module_id
    case 1
      controller = p.K * ((p.Ti * s + 1) / (p.Ti * s));
    case 2
      controller = p.K * ((p.Tz * s + 1) / (p.Tp * s + 1));
    case 3
      controller = p.K * ((p.Ti * s + 1) / (p.Ti * s)) * ((p.Tz * s + 1) / (p.Tp * s + 1));
    case 4
      controller = p.K * ((p.beta * p.Tlag * s + 1) / (p.Tlag * s + 1)) * ((p.Tlead * s + 1) / (p.Tp * s + 1));
    otherwise
      controller = p.Kp * (1 + 1 / (p.Ti * s) + (p.Td * s) / (p.Tf * s + 1));
  endswitch
endfunction

function ff = feedforward_controller(module)
  s = tf("s");
  if module.module_id == 1
    ff = tf(0);
  elseif module.module_id == 2
    p = module.parameters;
    ff = p.K_ff * ((p.T_z * s + 1) / (p.T_p * s + 1));
  else
    p = module.parameters;
    ff = p.K_ff * ((p.T_d * s) / (p.T_f * s + 1));
  endif
endfunction

function hr = rate_feedback_filter(module)
  s = tf("s");
  if module.module_id == 1
    hr = tf(0);
  else
    p = module.parameters;
    hr = p.K_r / (p.T_r * s + 1);
  endif
endfunction

function response = response_struct(t, y)
  response = struct("t", t(:)', "y", y(:)');
endfunction

function trajectory = trajectory_struct(t, heading, speed)
  vx = speed .* cos(heading(:));
  vy = speed .* sin(heading(:));
  x = cumtrapz(t(:), vx);
  y = cumtrapz(t(:), vy);
  trajectory = struct("t", t(:)', "x", x(:)', "y", y(:)');
endfunction

function freq_struct = frequency_struct(sys, omega)
  resp = squeeze(freqresp(sys, omega));
  freq_struct = struct("w", omega(:)', "mag", abs(resp(:))', "mag_db", (20 * log10(max(abs(resp(:)), 1e-12)))', "phase_deg", (unwrap(angle(resp(:)))' * 180 / pi));
endfunction

function transition_error = transition_error_score(t, err, switch_times, horizon)
  transition_error = 0;
  for i = 1:numel(switch_times)
    mask = t >= switch_times(i) & t <= min(t(end), switch_times(i) + horizon);
    if any(mask)
      transition_error += trapz(t(mask), abs(err(mask)));
    endif
  endfor
endfunction

function tail_error = tail_segment_error(t, err, switch_times)
  segment_starts = [t(1); switch_times(:)];
  segment_ends = [switch_times(:); t(end)];
  tail_error = 0;
  for i = 1:numel(segment_starts)
    start_t = max(segment_starts(i), segment_ends(i) - 5);
    mask = t >= start_t & t <= segment_ends(i);
    if any(mask)
      tail_error = max(tail_error, max(abs(err(mask))));
    endif
  endfor
endfunction

function [metrics, branch_metrics, traces, trajectory, frequency_response] = collect_metrics(decoded, scenario, include_traces)
  s = tf("s");
  c_fb = feedback_controller(decoded.modules.feedback);
  f_r = feedforward_controller(decoded.modules.feedforward);
  h_r = rate_feedback_filter(decoded.modules.rate_feedback);
  denom = 1 + scenario.plant * (c_fb + h_r * s);
  y_over_r = minreal((scenario.plant * (c_fb + f_r)) / denom);
  e_over_r = minreal(1 - y_over_r);
  u_fb_tf = minreal(c_fb * e_over_r);
  u_ff_tf = minreal(f_r);
  u_rate_tf = minreal(-(h_r * s) * y_over_r);
  fb_closed = minreal((scenario.plant * c_fb) / denom);
  loop_gain = minreal(scenario.plant * (c_fb + h_r * s));

  mission_r = scenario.mission_reference(:);
  mission_t = scenario.mission_time(:);
  mission_y = lsim(y_over_r, mission_r, mission_t);
  u_feedback = lsim(u_fb_tf, mission_r, mission_t);
  u_feedforward = lsim(u_ff_tf, mission_r, mission_t);
  u_rate = lsim(u_rate_tf, mission_r, mission_t);
  mission_u = u_feedback + u_feedforward + u_rate;
  heading_rate = gradient(mission_y, mission_t);
  err = mission_r - mission_y;

  segment_mask = mission_t <= scenario.first_change_time;
  segment_y = mission_y(segment_mask);
  segment_t = mission_t(segment_mask);
  idx90 = find(segment_y >= 0.9 * scenario.first_target, 1, "first");
  if isempty(idx90)
    t90 = segment_t(end);
  else
    t90 = segment_t(idx90);
  endif

  traj_expected = trajectory_struct(mission_t, mission_r, scenario.trajectory_speed);
  traj_actual = trajectory_struct(mission_t, mission_y, scenario.trajectory_speed);
  traj_err = sqrt((traj_expected.x(:) - traj_actual.x(:)) .^ 2 + (traj_expected.y(:) - traj_actual.y(:)) .^ 2);
  poles = pole(y_over_r);
  stable = all(real(poles) < -1e-6);
  if include_traces
    [gm, pm, wg, wc] = margin(loop_gain);
    closed_freq = squeeze(freqresp(fb_closed, scenario.omega));
    M_r_value = max(abs(closed_freq(:)));
  else
    gm = Inf;
    pm = Inf;
    wg = NaN;
    wc = NaN;
    M_r_value = 1.0;
  endif

  metrics = struct();
  metrics.t90 = t90;
  metrics.tracking_error = trapz(mission_t, abs(err));
  metrics.transition_error = transition_error_score(mission_t, err, scenario.switch_times, 8.0);
  metrics.tail_segment_error = tail_segment_error(mission_t, err, scenario.switch_times);
  metrics.trajectory_error = trapz(mission_t, traj_err);
  metrics.u_max = max(abs(mission_u));
  metrics.control_energy = trapz(mission_t, mission_u .^ 2);
  metrics.phase_margin = pm;
  metrics.gain_margin = gm;
  metrics.phase_cross = wg;
  metrics.crossover = wc;
  metrics.M_r = M_r_value;
  metrics.stable = stable;
  metrics.segment_max_error = max(abs(err));

  branch_metrics = struct();
  branch_metrics.u_feedback_peak = max(abs(u_feedback));
  branch_metrics.u_feedforward_peak = max(abs(u_feedforward));
  branch_metrics.u_rate_peak = max(abs(u_rate));
  branch_metrics.heading_rate_peak = max(abs(heading_rate));

  traces = struct();
  trajectory = struct();
  frequency_response = struct();
  if include_traces
    traces = struct("reference", response_struct(mission_t, mission_r), "response", response_struct(mission_t, mission_y), "control", response_struct(mission_t, mission_u), "feedback_branch", response_struct(mission_t, u_feedback), "feedforward_branch", response_struct(mission_t, u_feedforward), "rate_branch", response_struct(mission_t, u_rate), "heading_rate", response_struct(mission_t, heading_rate));
    trajectory = struct("expected", traj_expected, "actual", traj_actual);
    frequency_response = struct("loop_gain", frequency_struct(loop_gain, scenario.omega), "feedback_closed", frequency_struct(fb_closed, scenario.omega), "reference_to_output", frequency_struct(y_over_r, scenario.omega));
  endif
endfunction

function screening_result = apply_screening(metrics, scenario)
  screening_result = struct();
  screening_result.stable = logical(metrics.stable);
  screening_result.u_peak_ok = logical(metrics.u_max <= scenario.u_peak_limit);
  screening_result.control_energy_ok = logical(metrics.control_energy <= scenario.control_energy_limit);
  screening_result.M_r_ok = logical(metrics.M_r <= scenario.screening.M_r_max);
  screening_result.trajectory_ok = logical(metrics.trajectory_error <= scenario.screening.trajectory_error_max);
  screening_result.transition_ok = logical(metrics.transition_error <= scenario.screening.transition_error_max);
  screening_result.tail_ok = logical(metrics.tail_segment_error <= scenario.screening.tail_segment_error_max);
  failed = {};
  if !screening_result.stable, failed{end + 1} = "stability"; endif
  if !screening_result.u_peak_ok, failed{end + 1} = "u_peak"; endif
  if !screening_result.control_energy_ok, failed{end + 1} = "control_energy"; endif
  if !screening_result.M_r_ok, failed{end + 1} = "M_r"; endif
  if !screening_result.trajectory_ok, failed{end + 1} = "trajectory_error"; endif
  if !screening_result.transition_ok, failed{end + 1} = "transition_error"; endif
  if !screening_result.tail_ok, failed{end + 1} = "tail_segment_error"; endif
  screening_result.failed_rules = failed;
  screening_result.passed = isempty(failed);
endfunction

function cost_breakdown = compute_cost(metrics, screening_result, scenario)
  numeric_values = [metrics.t90, metrics.tracking_error, metrics.transition_error, metrics.tail_segment_error, metrics.trajectory_error, metrics.u_max, metrics.control_energy, metrics.M_r];
  if !metrics.stable || any(!isfinite(numeric_values))
    cost_breakdown = struct("variant", "destroyer", "normalized", struct(), "weighted", struct(), "penalties", struct("unstable", 40.0), "total", 40.0);
    return;
  endif

  normalized = struct("transition_error", metrics.transition_error / scenario.screening.transition_error_max, "tracking_error", metrics.tracking_error / 70.0, "trajectory_error", metrics.trajectory_error / scenario.screening.trajectory_error_max, "u_peak", metrics.u_max / max(scenario.u_peak_limit, 1e-6), "control_energy", metrics.control_energy / max(scenario.control_energy_limit, 1e-6));
  weighted = struct("transition_error", 0.28 * normalized.transition_error, "tracking_error", 0.24 * normalized.tracking_error, "trajectory_error", 0.20 * normalized.trajectory_error, "u_peak", 0.14 * normalized.u_peak, "control_energy", 0.14 * normalized.control_energy);
  penalties = struct();
  penalties.robustness = 0.35 * max(0, metrics.M_r - scenario.screening.M_r_max)^2;
  penalties.tail = 0.30 * max(0, metrics.tail_segment_error - scenario.screening.tail_segment_error_max)^2;
  penalties.screen = 0.70 * numel(screening_result.failed_rules);
  penalties.unstable = 0.0;
  total = weighted.transition_error + weighted.tracking_error + weighted.trajectory_error + weighted.u_peak + weighted.control_energy + penalties.robustness + penalties.tail + penalties.screen;
  cost_breakdown = struct("variant", "destroyer", "normalized", normalized, "weighted", weighted, "penalties", penalties, "total", total);
endfunction

function evaluation = evaluate_candidate(decoded, scenario, include_traces)
  [metrics, branch_metrics, traces, trajectory, frequency_response] = collect_metrics(decoded, scenario, include_traces);
  screening_result = apply_screening(metrics, scenario);
  cost_breakdown = compute_cost(metrics, screening_result, scenario);
  evaluation = struct();
  evaluation.z = decoded.z;
  evaluation.modules = decoded.modules;
  evaluation.controller_components = struct("feedback", decoded.modules.feedback.expression, "feedforward", decoded.modules.feedforward.expression, "rate_feedback", decoded.modules.rate_feedback.expression, "total_control_law", "u=C_fb(r-psi)+F_r r-H_r dot(psi)");
  evaluation.metrics = metrics;
  evaluation.branch_metrics = branch_metrics;
  evaluation.screening = screening_result;
  evaluation.cost_breakdown = cost_breakdown;
  evaluation.cost_family = "destroyer";
  evaluation.cost_variant = "D";
  if include_traces
    evaluation.time_response = traces;
    evaluation.trajectory = trajectory;
    evaluation.frequency_response = frequency_response;
  else
    evaluation.time_response = struct();
    evaluation.trajectory = struct();
    evaluation.frequency_response = struct();
  endif
endfunction

probe_combo_structure_search();
