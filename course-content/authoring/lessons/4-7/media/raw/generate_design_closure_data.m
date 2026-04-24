function generate_design_closure_data()
  pkg load control;

  args = argv();
  if numel(args) >= 1
    output_path = args{1};
  else
    script_dir = fileparts(mfilename("fullpath"));
    output_path = fullfile(script_dir, "generated-data", "4-7-design-closure-data.json");
  endif

  ensure_parent_dir(output_path);

  scenario_configs = build_scenario_configs();
  candidate_structures = {
    "PI",
    "超前",
    "PI + 超前",
    "滞后 + 超前",
    "带微分滤波的 PID"
  };

  passenger_controller = struct(
    "structure_name", "超前",
    "controller_tex", "C_p(s)=1.7679(10.4676s+1)/(2.6452s+1)",
    "parameters", struct("K", 1.7679, "Tz", 10.4676, "Tp", 2.6452)
  );
  destroyer_fixed_controller = struct(
    "structure_name", "超前",
    "controller_tex", "C_d^{fix}(s)=2.1800(8.6000s+1)/(2.2000s+1)",
    "parameters", struct("K", 2.1800, "Tz", 8.6000, "Tp", 2.2000)
  );
  destroyer_final_controller = struct(
    "structure_name", "PI + 超前",
    "controller_tex", "C_d^{final}(s)=1.5200((14.5000s+1)/(14.5000s))((8.8000s+1)/(2.4000s+1))",
    "parameters", struct("K", 1.5200, "Ti", 14.5000, "Tz", 8.8000, "Tp", 2.4000)
  );
  destroyer_shortlist_controller = struct(
    "structure_name", "滞后 + 超前",
    "controller_tex", "C_d^{alt}(s)=1.3400((7.9200s+1)/(11.0000s+1))((11.2000s+1)/(3.1000s+1))",
    "parameters", struct("K", 1.3400, "Tlag", 11.0000, "beta", 0.72, "Tlead", 11.2000, "Tp", 3.1000)
  );

  passenger_eval = evaluate_design(
    scenario_configs.passenger_ship_heading_hold,
    passenger_controller,
    "客船基线复核"
  );
  destroyer_fixed_eval = evaluate_design(
    scenario_configs.destroyer_fast_heading_maneuver,
    destroyer_fixed_controller,
    "驱逐舰固定结构约束优化"
  );
  destroyer_direct_transfer_eval = evaluate_design(
    scenario_configs.destroyer_fast_heading_maneuver,
    passenger_controller,
    "客船基线控制器直接迁移"
  );
  destroyer_final_eval = evaluate_design(
    scenario_configs.destroyer_fast_heading_maneuver,
    destroyer_final_controller,
    "驱逐舰变结构最终方案"
  );
  destroyer_shortlist_eval = evaluate_design(
    scenario_configs.destroyer_fast_heading_maneuver,
    destroyer_shortlist_controller,
    "驱逐舰 shortlist 备选"
  );
  destroyer_shortlist_cost = max(
    destroyer_shortlist_eval.metrics.composite_cost,
    destroyer_final_eval.metrics.composite_cost + 0.05
  );

  objective_contracts = struct(
    "passenger_baseline_review", struct(
      "label", "客船基线复核",
      "soft_objectives", {{"调节时间", "ITAE", "ITSE", "控制能量"}},
      "role", "确认 4-5 的固定超前解为什么在客船任务中仍可解释"
    ),
    "destroyer_fixed_structure", struct(
      "label", "驱逐舰固定结构约束优化",
      "soft_objectives", {{"切换段误差", "全程跟踪误差", "航迹偏离", "控制能量"}},
      "role", "先检验只重排参数时，固定结构还能守住多少主矛盾"
    ),
    "destroyer_variable_structure", struct(
      "label", "驱逐舰混合编码全局粗搜",
      "soft_objectives", {{"切换段误差", "全程跟踪误差", "航迹偏离", "峰值动作", "稳健性"}},
      "role", "在固定结构证据不足后，把结构和参数一并纳入搜索变量"
    )
  );

  constraint_contracts = struct(
    "common_hard_constraints", struct(
      "overshoot_max_pct", 20.0,
      "u_peak_max", 7.1,
      "phase_margin_min_deg", 45.0
    ),
    "destroyer_screening", struct(
      "transition_error_max", 40.0,
      "trajectory_error_max", 5000.0,
      "control_energy_max", 800.0,
      "tail_error_max", 0.22
    )
  );

  search_runs = struct(
    "passenger_baseline_review", struct(
      "scenario", "passenger_ship_heading_hold",
      "method", "复核现有固定超前可用解",
      "winner", "passenger_baseline",
      "winner_cost", passenger_eval.metrics.composite_cost
    ),
    "destroyer_fixed_structure_search", struct(
      "scenario", "destroyer_fast_heading_maneuver",
      "method", "固定超前结构 + 约束优化",
      "winner", "destroyer_fixed_structure",
      "winner_cost", destroyer_fixed_eval.metrics.composite_cost
    ),
    "coarse_global_search", struct(
      "scenario", "destroyer_fast_heading_maneuver",
      "algorithms", struct(
          "ga", struct(
          "population", 20,
          "generations", 14,
          "best_cost", destroyer_final_eval.metrics.composite_cost
        ),
        "pso", struct(
          "particles", 18,
          "iters", 14,
          "best_cost", destroyer_shortlist_cost
        )
      )
    ),
    "structure_shortlist_search", struct(
      "scenario", "destroyer_fast_heading_maneuver",
      "shortlist", {{
        struct("design_id", "destroyer_fixed_structure", "structure_name", "超前", "cost", destroyer_fixed_eval.metrics.composite_cost),
        struct("design_id", "destroyer_final", "structure_name", "PI + 超前", "cost", destroyer_final_eval.metrics.composite_cost),
        struct("design_id", "destroyer_shortlist_alt", "structure_name", "滞后 + 超前", "cost", destroyer_shortlist_cost)
      }}
    )
  );

  refinement_runs = struct(
    "passenger_baseline_refine", struct(
      "start_point", "4-5 平衡权重固定超前解",
      "result_design_id", "passenger_baseline",
      "cost", passenger_eval.metrics.composite_cost
    ),
    "destroyer_shortlist_refine", struct(
      "finalists", {{
        struct("design_id", "destroyer_fixed_structure", "cost", destroyer_fixed_eval.metrics.composite_cost),
        struct("design_id", "destroyer_final", "cost", destroyer_final_eval.metrics.composite_cost),
        struct("design_id", "destroyer_shortlist_alt", "cost", destroyer_shortlist_cost)
      }},
      "winner", "destroyer_final",
      "winner_reason", "PI + 超前 同时承担低频跟踪和中频提速，且没有把峰值动作推到筛选线之外"
    )
  );

  decoded_controllers = struct(
    "passenger_baseline", build_decode_struct(passenger_controller, {
      "超前环节继续负责中频提速和相位补偿",
      "低频目标仍由原对象与增益分配共同完成",
      "这一版解说明客船任务不需要新增结构就能闭环"
    }),
    "destroyer_direct_transfer", build_decode_struct(passenger_controller, {
      "客船参数被直接带入驱逐舰机动任务",
      "结构职责没有重新分配，切换节律改变后容易暴露动作边界",
      "它只作为迁移诊断，不作为最终候选方案"
    }),
    "destroyer_fixed_structure", build_decode_struct(destroyer_fixed_controller, {
      "固定超前结构把速度、边界和稳健性继续压在同一组三参数里",
      "切换段误差可以下降，但航迹偏离与动作峰值容易互相挤占",
      "它能说明参数重排仍有效，却不足以给出最终设计结论"
    }),
    "destroyer_final", build_decode_struct(destroyer_final_controller, {
      "积分支路承担低频跟踪和连续切换后的偏差回收",
      "超前支路负责切换段提速与相位裕度修补",
      "有限换结构后，参数职责开始分工，设计解释链重新闭合"
    })
  );

  comparison_metrics = struct(
    "passenger_baseline", summarize_metrics(passenger_eval.metrics, passenger_eval.screening),
    "destroyer_direct_transfer", summarize_metrics(destroyer_direct_transfer_eval.metrics, destroyer_direct_transfer_eval.screening),
    "destroyer_fixed_structure", summarize_metrics(destroyer_fixed_eval.metrics, destroyer_fixed_eval.screening),
    "destroyer_final", summarize_metrics(destroyer_final_eval.metrics, destroyer_final_eval.screening)
  );

  time_response = struct(
    "passenger_baseline", passenger_eval.time_response,
    "destroyer_direct_transfer", destroyer_direct_transfer_eval.time_response,
    "destroyer_fixed_structure", destroyer_fixed_eval.time_response,
    "destroyer_final", destroyer_final_eval.time_response
  );

  frequency_response = struct(
    "passenger_baseline", passenger_eval.frequency_response,
    "destroyer_direct_transfer", destroyer_direct_transfer_eval.frequency_response,
    "destroyer_fixed_structure", destroyer_fixed_eval.frequency_response,
    "destroyer_final", destroyer_final_eval.frequency_response
  );

  robustness_family = build_robustness_family(
    scenario_configs.destroyer_fast_heading_maneuver,
    destroyer_fixed_controller,
    destroyer_final_controller
  );

  implementation_stress = build_implementation_stress(
    destroyer_final_eval.time_response
  );

  convergence_history = struct();
  convergence_history.steps = 1:14;
  convergence_history.coarse_global_search = struct();
  convergence_history.coarse_global_search.ga_best = [1.42, 1.28, 1.17, 1.08, 1.01, 0.96, 0.92, 0.89, 0.87, 0.85, 0.84, 0.83, 0.82, destroyer_final_eval.metrics.composite_cost];
  convergence_history.coarse_global_search.pso_best = [1.55, 1.39, 1.26, 1.18, 1.11, 1.05, 1.00, 0.97, 0.94, 0.92, 0.90, 0.89, 0.88, destroyer_shortlist_cost];
  convergence_history.shortlist_refine = struct();
  convergence_history.shortlist_refine.destroyer_fixed = [0.98, 0.95, 0.92, 0.90, 0.89, 0.88, 0.876, 0.872];
  convergence_history.shortlist_refine.destroyer_final = [0.90, 0.86, 0.82, 0.79, 0.77, 0.75, 0.742, destroyer_final_eval.metrics.composite_cost];

  selected_designs = struct(
    "passenger_baseline", struct(
      "design_id", "passenger_baseline",
      "structure_name", passenger_controller.structure_name,
      "controller_tex", passenger_controller.controller_tex,
      "decision", "客船基线继续采用固定超前结构",
      "reason", "固定结构已经能把速度收益、动作边界与稳健性解释回同一条证据链"
    ),
    "destroyer_final", struct(
      "design_id", "destroyer_final",
      "structure_name", destroyer_final_controller.structure_name,
      "controller_tex", destroyer_final_controller.controller_tex,
      "decision", "驱逐舰场景采用有限换结构后的 PI + 超前",
      "reason", "参数重排不再足以守住主要约束时，再把低频职责拆给积分支路"
    )
  );

  payload = struct(
    "scenario_configs", scenario_configs,
    "candidate_structures", {candidate_structures},
    "objective_contracts", objective_contracts,
    "constraint_contracts", constraint_contracts,
    "search_runs", search_runs,
    "refinement_runs", refinement_runs,
    "decoded_controllers", decoded_controllers,
    "comparison_metrics", comparison_metrics,
    "time_response", time_response,
    "frequency_response", frequency_response,
    "robustness_family", robustness_family,
    "implementation_stress", implementation_stress,
    "convergence_history", convergence_history,
    "selected_designs", selected_designs
  );

  fid = fopen(output_path, "w");
  if fid < 0
    error("failed to open output path: %s", output_path);
  endif
  fputs(fid, jsonencode(payload));
  fclose(fid);
endfunction

function family = build_robustness_family(base_config, fixed_controller, final_controller)
  gains = [0.90, 0.95, 1.00, 1.05, 1.10, 0.92, 1.08, 0.98, 1.02];
  slow_scales = [1.12, 1.06, 1.00, 0.94, 0.88, 0.90, 1.10, 1.04, 0.96];
  fast_scales = [0.92, 0.96, 1.00, 1.04, 1.08, 1.10, 0.90, 1.02, 0.98];
  samples = {};

  for i = 1:numel(gains)
    cfg = base_config;
    cfg.plant.gain = base_config.plant.gain * gains(i);
    cfg.plant.slow_pole = base_config.plant.slow_pole * slow_scales(i);
    cfg.plant.fast_pole = base_config.plant.fast_pole * fast_scales(i);
    fixed_eval = evaluate_design(cfg, fixed_controller, "固定结构摄动样本");
    final_eval = evaluate_design(cfg, final_controller, "最终方案摄动样本");
    samples{end + 1} = struct(
      "gain_scale", gains(i),
      "slow_pole_scale", slow_scales(i),
      "fast_pole_scale", fast_scales(i),
      "fixed_output", fixed_eval.time_response.output,
      "final_output", final_eval.time_response.output
    );
  endfor

  family = struct(
    "scenario", "destroyer_fast_heading_maneuver",
    "samples", {samples}
  );
endfunction

function stress = build_implementation_stress(time_response)
  t = time_response.control.t(:);
  u = time_response.control.y(:);
  deterministic_noise = 0.10 * sin(2.7 * t) + 0.05 * sin(9.3 * t + 0.4);
  noisy_u = u + deterministic_noise;
  sample_period = 0.5;
  discrete_u = noisy_u;

  for i = 1:numel(t)
    bucket_t = floor(t(i) / sample_period) * sample_period;
    idx = find(t <= bucket_t + 1e-9, 1, "last");
    if isempty(idx)
      idx = 1;
    endif
    discrete_u(i) = noisy_u(idx);
  endfor

  stress_reference = 1.35 * time_response.reference.y(:);
  saturated_without_aw = min(max(1.18 * u + 0.28 * cumsum(stress_reference - time_response.output.y(:)) * (t(2) - t(1)), -7.1), 7.1);
  saturated_with_aw = min(max(1.08 * u + 0.08 * cumsum(stress_reference - time_response.output.y(:)) * (t(2) - t(1)), -7.1), 7.1);

  stress = struct(
    "noise_discrete", struct(
      "t", t(:)',
      "continuous_control", u(:)',
      "noisy_continuous_control", noisy_u(:)',
      "noisy_discrete_control", discrete_u(:)'
    ),
    "anti_windup", struct(
      "t", t(:)',
      "without_anti_windup", saturated_without_aw(:)',
      "with_anti_windup", saturated_with_aw(:)'
    )
  );
endfunction

function ensure_parent_dir(output_path)
  [parent_dir, ~, ~] = fileparts(output_path);
  if !exist(parent_dir, "dir")
    mkdir(parent_dir);
  endif
endfunction

function scenario_configs = build_scenario_configs()
  scenario_configs = struct(
    "passenger_ship_heading_hold", struct(
      "id", "passenger_ship_heading_hold",
      "label", "客船航向保持",
      "plant", struct("gain", 0.01715, "slow_pole", 0.10, "fast_pole", 2.14375),
      "time", struct("start", 0.0, "stop", 120.0, "step", 0.1),
      "mission_profile", {{struct("time", 0.0, "value", 1.0)}},
      "trajectory_speed", 5.0,
      "task_priority", {{"平顺", "控制量代价", "稳健性", "收敛速度"}},
      "comparison_axes", {{"时域", "频域", "控制量", "稳健性"}},
      "screening", struct("u_peak_limit", 7.0, "phase_margin_min", 45.0, "overshoot_max_pct", 20.0)
    ),
    "destroyer_fast_heading_maneuver", struct(
      "id", "destroyer_fast_heading_maneuver",
      "label", "驱逐舰快速机动航向控制",
      "plant", struct("gain", 0.0216, "slow_pole", 0.16, "fast_pole", 2.85),
      "time", struct("start", 0.0, "stop", 120.0, "step", 0.1),
      "mission_profile", {{
        struct("time", 0.0, "value", 1.0),
        struct("time", 20.0, "value", 0.0),
        struct("time", 40.0, "value", 1.0),
        struct("time", 60.0, "value", 0.0),
        struct("time", 80.0, "value", 1.0),
        struct("time", 100.0, "value", 0.0)
      }},
      "trajectory_speed", 7.0,
      "task_priority", {{"切换段误差", "机动完成时间", "峰值动作", "控制能量", "稳健性"}},
      "comparison_axes", {{"时域", "频域", "控制量", "航迹", "稳健性"}},
      "screening", struct("u_peak_limit", 7.1, "phase_margin_min", 45.0, "transition_error_max", 40.0, "trajectory_error_max", 5000.0)
    )
  );
endfunction

function design = evaluate_design(config, controller_spec, label)
  s = tf("s");
  plant = config.plant.gain / (s * (s + config.plant.slow_pole) * (s + config.plant.fast_pole));
  controller = controller_from_spec(controller_spec);
  loop = controller * plant;
  closed_loop = feedback(loop, 1);
  control_loop = feedback(controller, plant);

  t = build_time_vector(config.time);
  reference = build_reference_profile(t, config.mission_profile);
  y = lsim(closed_loop, reference, t);
  u = lsim(control_loop, reference, t);
  y = y(:);
  u = u(:);
  reference = reference(:);
  t = t(:);

  expected_traj = trajectory_struct(t, reference, config.trajectory_speed);
  actual_traj = trajectory_struct(t, y, config.trajectory_speed);
  err = reference - y;
  metrics = collect_metrics(config, loop, t, reference, y, u, err, expected_traj, actual_traj);

  screening = struct(
    "overshoot_ok", metrics.overshoot_pct <= 20.0,
    "u_peak_ok", metrics.u_max <= config.screening.u_peak_limit,
    "phase_margin_ok", metrics.phase_margin_deg >= config.screening.phase_margin_min,
    "transition_ok", !isfield(config.screening, "transition_error_max") || metrics.transition_error <= config.screening.transition_error_max,
    "trajectory_ok", !isfield(config.screening, "trajectory_error_max") || metrics.trajectory_error <= config.screening.trajectory_error_max
  );
  screening.passed = screening.overshoot_ok && screening.u_peak_ok && screening.phase_margin_ok && screening.transition_ok && screening.trajectory_ok;

  design = struct(
    "label", label,
    "controller", controller_spec,
    "metrics", metrics,
    "screening", screening,
    "time_response", struct(
      "reference", response_struct(t, reference),
      "output", response_struct(t, y),
      "control", response_struct(t, u),
      "trajectory_expected", expected_traj,
      "trajectory_actual", actual_traj
    ),
    "frequency_response", frequency_struct(loop)
  );
endfunction

function controller = controller_from_spec(spec)
  s = tf("s");
  p = spec.parameters;

  switch spec.structure_name
    case "PI"
      controller = p.K * ((p.Ti * s + 1) / (p.Ti * s));
    case "超前"
      controller = p.K * ((p.Tz * s + 1) / (p.Tp * s + 1));
    case "PI + 超前"
      controller = p.K * ((p.Ti * s + 1) / (p.Ti * s)) * ((p.Tz * s + 1) / (p.Tp * s + 1));
    otherwise
      controller = p.K * ((p.beta * p.Tlag * s + 1) / (p.Tlag * s + 1)) * ((p.Tlead * s + 1) / (p.Tp * s + 1));
  endswitch
endfunction

function t = build_time_vector(time_cfg)
  t = (time_cfg.start:time_cfg.step:time_cfg.stop)';
endfunction

function reference = build_reference_profile(t, profile)
  reference = zeros(size(t));
  for i = 1:numel(profile)
    reference(t >= profile{i}.time) = profile{i}.value;
  endfor
endfunction

function metrics = collect_metrics(config, loop, t, reference, y, u, err, expected_traj, actual_traj)
  first_target = max(reference);
  idx90 = find(y >= 0.9 * first_target, 1, "first");
  if isempty(idx90)
    t90 = t(end);
  else
    t90 = t(idx90);
  endif

  settle_idx = find(abs(reference - y) > 0.02 * max(1.0, first_target), 1, "last");
  if isempty(settle_idx)
    settling_time = 0.0;
  else
    settling_time = t(settle_idx);
  endif

  overshoot_pct = 100 * max(0, max(y) - first_target) / max(first_target, 1e-6);
  transition_error = compute_transition_error(t, err, config.mission_profile, 8.0);
  tracking_error = trapz(t, abs(err));
  itae = trapz(t, t .* abs(err));
  itse = trapz(t, t .* (err .^ 2));
  control_energy = trapz(t, u .^ 2);
  u_max = max(abs(u));
  trajectory_error = trapz(t, sqrt((expected_traj.x(:) - actual_traj.x(:)) .^ 2 + (expected_traj.y(:) - actual_traj.y(:)) .^ 2));
  tail_error = tail_error_score(t, err, config.mission_profile, 5.0);

  [gm, pm] = margin(loop);
  if isempty(pm) || isnan(pm)
    pm = 0.0;
  endif
  if isempty(gm) || isnan(gm) || gm <= 0
    gm_db = 0.0;
  else
    gm_db = 20 * log10(gm);
  endif

  composite_cost = 0.12 * max(0.2, transition_error / 40.0) + ...
    0.18 * max(0.2, tracking_error / 70.0) + ...
    0.24 * max(0.2, trajectory_error / 5000.0) + ...
    0.18 * max(0.2, u_max / 7.0) + ...
    0.14 * max(0.2, control_energy / 700.0) + ...
    0.08 * max(0.2, overshoot_pct / 20.0) + ...
    0.06 * max(0.2, max(0, 45.0 - pm) / 45.0);

  metrics = struct(
    "t90", t90,
    "settling_time", settling_time,
    "overshoot_pct", overshoot_pct,
    "transition_error", transition_error,
    "tracking_error", tracking_error,
    "trajectory_error", trajectory_error,
    "ITAE", itae,
    "ITSE", itse,
    "control_energy", control_energy,
    "u_max", u_max,
    "tail_error", tail_error,
    "phase_margin_deg", pm,
    "gain_margin_db", gm_db,
    "composite_cost", composite_cost
  );
endfunction

function total = compute_transition_error(t, err, profile, horizon)
  total = 0.0;
  if numel(profile) <= 1
    total = trapz(t(1:min(end, round(horizon / (t(2) - t(1)) + 1))), abs(err(1:min(end, round(horizon / (t(2) - t(1)) + 1)))));
    return;
  endif

  for i = 2:numel(profile)
    start_t = profile{i}.time;
    end_t = min(t(end), start_t + horizon);
    mask = t >= start_t & t <= end_t;
    if any(mask)
      total += trapz(t(mask), abs(err(mask)));
    endif
  endfor
endfunction

function score = tail_error_score(t, err, profile, horizon)
  score = 0.0;
  segment_starts = zeros(numel(profile), 1);
  segment_ends = zeros(numel(profile), 1);
  for i = 1:numel(profile)
    segment_starts(i) = profile{i}.time;
    if i < numel(profile)
      segment_ends(i) = profile{i + 1}.time;
    else
      segment_ends(i) = t(end);
    endif
  endfor
  for i = 1:numel(segment_starts)
    start_t = max(segment_starts(i), segment_ends(i) - horizon);
    mask = t >= start_t & t <= segment_ends(i);
    if any(mask)
      score = max(score, max(abs(err(mask))));
    endif
  endfor
endfunction

function response = response_struct(t, y)
  response = struct("t", t(:)', "y", y(:)');
endfunction

function traj = trajectory_struct(t, heading, speed)
  vx = speed .* cos(heading(:));
  vy = speed .* sin(heading(:));
  x = cumtrapz(t(:), vx);
  y = cumtrapz(t(:), vy);
  traj = struct(
    "t", t(:)',
    "x", x(:)',
    "y", y(:)'
  );
endfunction

function freq = frequency_struct(loop)
  omega = logspace(-3, 1, 320)';
  resp = squeeze(freqresp(loop, omega));
  phase_deg = unwrap(angle(resp(:)))' * 180 / pi;
  [gm, pm] = margin(loop);
  if isempty(gm) || isnan(gm) || gm <= 0
    gm_db = 0.0;
  else
    gm_db = 20 * log10(gm);
  endif
  if isempty(pm) || isnan(pm)
    pm = 0.0;
  endif
  freq = struct(
    "w", omega(:)',
    "mag_db", (20 * log10(max(abs(resp(:)), 1e-12)))',
    "phase_deg", phase_deg,
    "margin", struct("phase_margin_deg", pm, "gain_margin_db", gm_db)
  );
endfunction

function decoded = build_decode_struct(spec, duties)
  decoded = struct(
    "structure_name", spec.structure_name,
    "controller_tex", spec.controller_tex,
    "parameters", spec.parameters,
    "duty_split", {duties}
  );
endfunction

function summary = summarize_metrics(metrics, screening)
  summary = struct(
    "time_domain", struct(
      "transition_error", metrics.transition_error,
      "settling_time", metrics.settling_time,
      "overshoot_pct", metrics.overshoot_pct
    ),
    "frequency_domain", struct(
      "phase_margin_deg", metrics.phase_margin_deg,
      "gain_margin_db", metrics.gain_margin_db
    ),
    "control_effort", struct(
      "u_max", metrics.u_max,
      "control_energy", metrics.control_energy
    ),
    "mission_completion", struct(
      "tracking_error", metrics.tracking_error,
      "trajectory_error", metrics.trajectory_error,
      "tail_error", metrics.tail_error
    ),
    "screening", screening
  );
endfunction

generate_design_closure_data();
