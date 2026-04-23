function probe_feedforward_structure_search()
  pkg load control;

  args = argv();
  if numel(args) < 2
    error("usage: octave -qf probe_feedforward_structure_search.m <input.json> <output.json>");
  endif

  input_payload = jsondecode(fileread(args{1}));
  output_path = args{2};

  scenario = scenario_from_config(input_payload.scenario_configs.destroyer_fast_heading_maneuver);
  feedback_decoded = decode_feedback_vector(input_payload.feedback_z);
  ff_candidates = input_payload.ff_candidates;
  if isvector(ff_candidates)
    ff_candidates = reshape(ff_candidates, 1, []);
  endif
  include_traces = isfield(input_payload, "include_traces") && logical(input_payload.include_traces);

  evaluations = struct([]);
  for i = 1:rows(ff_candidates)
    ff_decoded = decode_feedforward_vector(ff_candidates(i, :));
    evaluations(i) = evaluate_feedforward_candidate(feedback_decoded, ff_decoded, scenario, include_traces);
  endfor

  payload = struct();
  payload.feedback = struct(
    "z", input_payload.feedback_z,
    "structure_id", feedback_decoded.structure_id,
    "structure_name", feedback_decoded.structure_name,
    "parameters", feedback_decoded.parameters,
    "controller_tex", controller_tex(feedback_decoded)
  );
  payload.evaluations = evaluations;

  fid = fopen(output_path, "w");
  if fid < 0
    error("failed to open output path: %s", output_path);
  endif
  fputs(fid, jsonencode(payload));
  fclose(fid);
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

function decoded = decode_feedback_vector(z)
  z = z(:)';
  structure_id = max(1, min(5, ceil(5 * z(1))));
  decoded = struct();
  decoded.z = z;
  decoded.structure_id = structure_id;

  switch structure_id
    case 1
      decoded.structure_name = "PI";
      decoded.parameters = struct(
        "K", scale01(z(2), 0.90, 2.20),
        "Ti", scale01(z(3), 8.00, 28.00)
      );
    case 2
      decoded.structure_name = "lead";
      decoded.structure_name = "超前";
      decoded.parameters = struct(
        "K", scale01(z(2), 1.00, 2.73),
        "Tz", scale01(z(3), 8.00, 17.585),
        "Tp", scale01(z(4), 4.00, 7.33)
      );
    case 3
      decoded.structure_name = "PI + 超前";
      decoded.parameters = struct(
        "K", scale01(z(2), 1.00, 2.20),
        "Ti", scale01(z(3), 6.00, 48.00),
        "Tz", scale01(z(4), 5.00, 22.00),
        "Tp", scale01(z(5), 1.80, 6.00)
      );
    case 4
      decoded.structure_name = "滞后 + 超前";
      decoded.parameters = struct(
        "K", scale01(z(2), 0.90, 2.10),
        "Tlag", scale01(z(3), 6.00, 18.00),
        "beta", scale01(z(4), 0.65, 0.96),
        "Tlead", scale01(z(5), 6.00, 18.00),
        "Tp", scale01(z(6), 2.50, 6.20)
      );
    otherwise
      decoded.structure_name = "带微分滤波的 PID";
      decoded.parameters = struct(
        "Kp", scale01(z(2), 0.90, 2.50),
        "Ti", scale01(z(3), 8.00, 22.00),
        "Td", scale01(z(4), 0.50, 3.80),
        "Tf", scale01(z(5), 0.04, 0.20)
      );
  endswitch
endfunction

function controller = controller_from_decoded(decoded)
  s = tf("s");
  p = decoded.parameters;

  switch decoded.structure_id
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

function text = controller_tex(decoded)
  p = decoded.parameters;

  switch decoded.structure_id
    case 1
      text = sprintf("C(s)=%.4f(%.4fs+1)/(%.4fs)", p.K, p.Ti, p.Ti);
    case 2
      text = sprintf("C(s)=%.4f(%.4fs+1)/(%.4fs+1)", p.K, p.Tz, p.Tp);
    case 3
      text = sprintf(
        "C(s)=%.4f(%.4fs+1)/(%.4fs)*(%.4fs+1)/(%.4fs+1)",
        p.K, p.Ti, p.Ti, p.Tz, p.Tp
      );
    case 4
      text = sprintf(
        "C(s)=%.4f(%.4fs+1)/(%.4fs+1)*(%.4fs+1)/(%.4fs+1)",
        p.K, p.beta * p.Tlag, p.Tlag, p.Tlead, p.Tp
      );
    otherwise
      text = sprintf(
        "C(s)=%.4f(1+1/(%.4fs)+(%.4fs)/(%.4fs+1))",
        p.Kp, p.Ti, p.Td, p.Tf
      );
  endswitch
endfunction

function ff_decoded = decode_feedforward_vector(z)
  z = z(:)';
  ff_decoded = struct();
  ff_decoded.z = z;
  ff_decoded.Kff = scale01(z(1), 0.00, 2.40);
  ff_decoded.Tff = scale01(z(2), 0.40, 8.00);
  ff_decoded.alpha = scale01(z(3), 0.05, 0.60);
endfunction

function ff = feedforward_from_decoded(decoded)
  s = tf("s");
  ff = decoded.Kff * ((decoded.Tff * s) / (decoded.alpha * decoded.Tff * s + 1));
endfunction

function text = feedforward_tex(decoded)
  text = sprintf(
    "F(s)=%.4f(%.4fs)/(%.4fs+1)",
    decoded.Kff,
    decoded.Tff,
    decoded.alpha * decoded.Tff
  );
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

function metrics = collect_metrics(controller, ff, scenario)
  closed_loop = scenario.plant * (controller + ff) / (1 + scenario.plant * controller);
  control_loop = (controller + ff) / (1 + scenario.plant * controller);

  mission_y = lsim(closed_loop, scenario.mission_reference, scenario.mission_time);
  mission_u = lsim(control_loop, scenario.mission_reference, scenario.mission_time);
  mission_y = mission_y(:);
  mission_u = mission_u(:);
  mission_t = scenario.mission_time(:);
  mission_r = scenario.mission_reference(:);
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

  feedback_closed = feedback(controller * scenario.plant, 1);
  poles = pole(feedback_closed);
  stable = all(real(poles) < -1e-6);
  closed_freq = squeeze(freqresp(feedback_closed, scenario.omega));

  metrics = struct();
  metrics.t90 = t90;
  metrics.tracking_error = trapz(mission_t, abs(err));
  metrics.transition_error = transition_error_score(mission_t, err, scenario.switch_times, 8.0);
  metrics.tail_segment_error = tail_segment_error(mission_t, err, scenario.switch_times);
  metrics.trajectory_error = trapz(mission_t, traj_err);
  metrics.u_max = max(abs(mission_u));
  metrics.control_energy = trapz(mission_t, mission_u .^ 2);
  metrics.M_r = max(abs(closed_freq(:)));
  metrics.stable = stable;
endfunction

function screening_result = apply_screening(metrics, scenario)
  screening_result = struct();
  screening_result.stable = logical(metrics.stable);
  screening_result.u_peak_ok = logical(metrics.u_max <= scenario.u_peak_limit);
  screening_result.control_energy_ok = logical(metrics.control_energy <= scenario.control_energy_limit);
  screening_result.M_r_ok = logical(metrics.M_r <= scenario.screening.M_r_max);
  screening_result.trajectory_ok = logical(metrics.trajectory_error <= scenario.screening.trajectory_error_max);

  failed = {};
  if !screening_result.stable
    failed{end + 1} = "stability";
  endif
  if !screening_result.u_peak_ok
    failed{end + 1} = "u_peak";
  endif
  if !screening_result.control_energy_ok
    failed{end + 1} = "control_energy";
  endif
  if !screening_result.M_r_ok
    failed{end + 1} = "M_r";
  endif
  if !screening_result.trajectory_ok
    failed{end + 1} = "trajectory_error";
  endif

  screening_result.failed_rules = failed;
  screening_result.passed = isempty(failed);
endfunction

function cost_breakdown = compute_destroyer_cost(metrics, screening_result, scenario)
  numeric_values = [
    metrics.t90,
    metrics.tracking_error,
    metrics.transition_error,
    metrics.tail_segment_error,
    metrics.trajectory_error,
    metrics.u_max,
    metrics.control_energy,
    metrics.M_r
  ];

  if !metrics.stable || any(!isfinite(numeric_values))
    cost_breakdown = struct(
      "normalized", struct(),
      "weighted", struct(),
      "penalties", struct("unstable", 40.0),
      "total", 40.0
    );
    return;
  endif

  normalized = struct(
    "transition_error", metrics.transition_error / scenario.screening.transition_error_max,
    "tracking_error", metrics.tracking_error / 70.0,
    "trajectory_error", metrics.trajectory_error / scenario.screening.trajectory_error_max,
    "u_peak", metrics.u_max / max(scenario.u_peak_limit, 1e-6),
    "control_energy", metrics.control_energy / max(scenario.control_energy_limit, 1e-6)
  );
  weighted = struct(
    "transition_error", 0.28 * normalized.transition_error,
    "tracking_error", 0.24 * normalized.tracking_error,
    "trajectory_error", 0.20 * normalized.trajectory_error,
    "u_peak", 0.14 * normalized.u_peak,
    "control_energy", 0.14 * normalized.control_energy
  );
  penalties = struct();
  penalties.robustness = 0.35 * max(0, metrics.M_r - scenario.screening.M_r_max)^2;
  penalties.tail = 0.30 * max(0, metrics.tail_segment_error - scenario.screening.tail_segment_error_max)^2;
  penalties.screen = 0.70 * numel(screening_result.failed_rules);
  penalties.unstable = 0.0;
  total = weighted.transition_error + weighted.tracking_error + weighted.trajectory_error ...
    + weighted.u_peak + weighted.control_energy + penalties.robustness + penalties.tail + penalties.screen;

  cost_breakdown = struct(
    "variant", "destroyer_ff_probe",
    "normalized", normalized,
    "weighted", weighted,
    "penalties", penalties,
    "total", total
  );
endfunction

function evaluation = evaluate_feedforward_candidate(feedback_decoded, ff_decoded, scenario, include_traces)
  controller = controller_from_decoded(feedback_decoded);
  ff = feedforward_from_decoded(ff_decoded);
  metrics = collect_metrics(controller, ff, scenario);
  screening_result = apply_screening(metrics, scenario);
  cost_breakdown = compute_destroyer_cost(metrics, screening_result, scenario);

  evaluation = struct();
  evaluation.feedback = struct(
    "structure_id", feedback_decoded.structure_id,
    "structure_name", feedback_decoded.structure_name,
    "parameters", feedback_decoded.parameters,
    "controller_tex", controller_tex(feedback_decoded)
  );
  evaluation.feedforward = struct(
    "Kff", ff_decoded.Kff,
    "Tff", ff_decoded.Tff,
    "alpha", ff_decoded.alpha,
    "feedforward_tex", feedforward_tex(ff_decoded)
  );
  evaluation.metrics = metrics;
  evaluation.screening = screening_result;
  evaluation.cost_breakdown = cost_breakdown;

  if include_traces
    closed_loop = scenario.plant * (controller + ff) / (1 + scenario.plant * controller);
    control_loop = (controller + ff) / (1 + scenario.plant * controller);
    mission_y = lsim(closed_loop, scenario.mission_reference, scenario.mission_time);
    mission_u = lsim(control_loop, scenario.mission_reference, scenario.mission_time);
    evaluation.time_response = struct(
      "reference", response_struct(scenario.mission_time, scenario.mission_reference),
      "response", response_struct(scenario.mission_time, mission_y),
      "control", response_struct(scenario.mission_time, mission_u)
    );
    evaluation.trajectory = struct(
      "expected", trajectory_struct(scenario.mission_time, scenario.mission_reference, scenario.trajectory_speed),
      "actual", trajectory_struct(scenario.mission_time, mission_y, scenario.trajectory_speed)
    );
  endif
endfunction

probe_feedforward_structure_search();
