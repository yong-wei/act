pkg load control;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "4-5-constraint-data.json");

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

function out = vector_to_struct(x)
  x = x(:);
  out = struct();
  out.K = x(1);
  out.T = x(2);
  out.alpha = x(3);
  out.alphaT = x(2) * x(3);
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

function metrics = collect_tracking_metrics(controller, plant, t)
  closed_loop = feedback(controller * plant, 1);
  control_loop = feedback(controller, plant);

  [y, t_out] = step(closed_loop, t);
  [u, ~] = step(control_loop, t);

  y = y(:);
  u = u(:);
  t_out = t_out(:);
  final_value = dcgain(closed_loop);
  if ~isfinite(final_value) || abs(final_value) < 1e-12
    final_value = y(end);
  endif
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

function penalty = bound_penalty(x, lb, ub)
  x = x(:);
  under = max(0, lb(:) - x);
  over = max(0, x - ub(:));
  penalty = 200 * sum((under + over) .^ 2);
endfunction

function score = weighted_tracking_score(metrics, weights, refs)
  score = ...
    weights(1) * (metrics.settling_time / refs.settling_time_ref) + ...
    weights(2) * (metrics.itae / refs.itae_ref) + ...
    weights(3) * (metrics.itse / refs.itse_ref) + ...
    weights(4) * (metrics.control_energy / refs.control_energy_ref);
endfunction

function [score, metrics] = heading_unconstrained_cost(x, plant, t, weights, refs, lb, ub)
  controller = heading_controller_from_x(x);
  metrics = collect_tracking_metrics(controller, plant, t);
  score = weighted_tracking_score(metrics, weights, refs) + bound_penalty(x, lb, ub);
endfunction

function value = heading_unconstrained_objective(x, plant, t, weights, refs, lb, ub)
  [value, ~] = heading_unconstrained_cost(x, plant, t, weights, refs, lb, ub);
endfunction

function [c, ceq] = heading_nonlcon(x, plant, t, thresholds)
  controller = heading_controller_from_x(x);
  metrics = collect_tracking_metrics(controller, plant, t);
  c = [
    metrics.overshoot - thresholds.overshoot;
    metrics.control_peak - thresholds.control_peak;
    thresholds.phase_margin - metrics.phase_margin
  ];
  ceq = [];
endfunction

function entry = heading_payload(id, label, x, plant, t, omega, weights, refs, thresholds)
  controller = heading_controller_from_x(x);
  closed_loop = feedback(controller * plant, 1);
  control_loop = feedback(controller, plant);
  metrics = collect_tracking_metrics(controller, plant, t);

  entry = struct();
  entry.id = id;
  entry.label = label;
  entry.parameters = vector_to_struct(x);
  entry.controller_tex = heading_controller_tex("C", x);
  entry.weights = weights;
  entry.weights_label = sprintf("[%.2f, %.2f, %.2f, %.2f]", weights(1), weights(2), weights(3), weights(4));
  entry.response = response_to_struct(t, step(closed_loop, t));
  entry.control = response_to_struct(t, step(control_loop, t));
  entry.open_loop = freqresp_to_struct(controller * plant, omega);
  entry.metrics = metrics;
  entry.objective = weighted_tracking_score(metrics, weights, refs);
  entry.feasible = ...
    metrics.overshoot <= thresholds.overshoot && ...
    metrics.control_peak <= thresholds.control_peak && ...
    metrics.phase_margin >= thresholds.phase_margin;
endfunction

function controller = structure_leadlag_controller_from_x(x)
  s = tf("s");
  x = x(:);
  controller = x(1) * ((x(2) * s + 1) / (x(3) * s + 1));
endfunction

function controller = structure_pid_controller_from_x(x)
  s = tf("s");
  x = x(:);
  n = 20;
  controller = x(1) * (1 + 1 / (x(2) * s) + (x(3) * s) / ((x(3) / n) * s + 1));
endfunction

function out = structure_leadlag_params(x)
  x = x(:);
  out = struct("K", x(1), "Tz", x(2), "Tp", x(3));
endfunction

function out = structure_pid_params(x)
  x = x(:);
  out = struct("Kp", x(1), "Ti", x(2), "Td", x(3), "N", 20);
endfunction

function [score, metrics] = structure_cost(x, controller_builder, plant, t, weights, refs, lb, ub)
  controller = controller_builder(x);
  metrics = collect_tracking_metrics(controller, plant, t);
  score = weighted_tracking_score(metrics, weights, refs) + bound_penalty(x, lb, ub);
endfunction

function value = structure_objective(x, controller_builder, plant, t, weights, refs, lb, ub)
  [value, ~] = structure_cost(x, controller_builder, plant, t, weights, refs, lb, ub);
endfunction

function entry = structure_payload(id, label, x, controller_builder, params_builder, tex_builder, plant, t, omega, weights, refs, thresholds)
  controller = controller_builder(x);
  closed_loop = feedback(controller * plant, 1);
  control_loop = feedback(controller, plant);
  metrics = collect_tracking_metrics(controller, plant, t);

  entry = struct();
  entry.id = id;
  entry.label = label;
  entry.parameters = params_builder(x);
  entry.controller_tex = tex_builder(x);
  entry.weights = weights;
  entry.weights_label = sprintf("[%.2f, %.2f, %.2f, %.2f]", weights(1), weights(2), weights(3), weights(4));
  entry.response = response_to_struct(t, step(closed_loop, t));
  entry.control = response_to_struct(t, step(control_loop, t));
  entry.open_loop = freqresp_to_struct(controller * plant, omega);
  entry.metrics = metrics;
  entry.objective = weighted_tracking_score(metrics, weights, refs);
  entry.feasible = ...
    metrics.overshoot <= thresholds.overshoot && ...
    metrics.control_peak <= thresholds.control_peak && ...
    metrics.phase_margin >= thresholds.phase_margin;
endfunction

s = tf("s");

ship_plant = 0.01715 / (s * (s + 0.1) * (s + 2.14375));
ship_t = 0:0.1:200;
ship_w = logspace(-3, 1, 500);

ship_x0 = [2.796; 10.0; 0.406];
ship_lb = [1.0; 4.0; 0.15];
ship_ub = [6.0; 15.0; 0.85];

ship_initial_metrics = collect_tracking_metrics(heading_controller_from_x(ship_x0), ship_plant, ship_t);
ship_refs = struct();
ship_refs.settling_time_ref = 40.0;
ship_refs.itae_ref = ship_initial_metrics.itae;
ship_refs.itse_ref = ship_initial_metrics.itse;
ship_refs.control_energy_ref = ship_initial_metrics.control_energy;

ship_thresholds = struct();
ship_thresholds.overshoot = 20.0;
ship_thresholds.control_peak = 7.0;
ship_thresholds.phase_margin = 45.0;

ship_equal_weights = [0.25, 0.25, 0.25, 0.25];
ship_balanced_weights = [0.30, 0.30, 0.20, 0.20];
ship_weight_sweep = {
  struct("id", "weight_a", "label", "速度优先 A", "weights", [0.40, 0.30, 0.20, 0.10], "x", [1.76; 10.25; 0.255]),
  struct("id", "weight_b", "label", "平衡权重 B", "weights", [0.30, 0.30, 0.20, 0.20], "x", [1.7679; 10.4676; 0.2527]),
  struct("id", "weight_c", "label", "动作代价优先 C", "weights", [0.20, 0.25, 0.25, 0.30], "x", [1.52; 10.90; 0.315])
};

x_weak = [5.0; 10.0; 0.2];
x_constrained = [1.7679; 10.4676; 0.2527];

ship_balanced_unconstrained_x = [2.0644; 9.9804; 2.0809 / 9.9804];
ship_balanced_constrained_x = [1.7679; 10.4676; 0.2527];

ship_weight_entries = {};
for i = 1:numel(ship_weight_sweep)
  item = ship_weight_sweep{i};
  ship_weight_entries{end + 1} = heading_payload(
    item.id,
    item.label,
    item.x,
    ship_plant,
    ship_t,
    ship_w,
    item.weights,
    ship_refs,
    ship_thresholds
  );
endfor

structure_weights = ship_balanced_weights;
structure_leadlag_x = ship_balanced_constrained_x;
structure_pid_x = [0.3205; 137.3; 100.0];

payload = struct();
payload.lesson_id = "4-5";
payload.required_packages = {"control"};
payload.install_commands = {};

payload.entries = {
  heading_payload("initial", "4-3 起始方案", ship_x0, ship_plant, ship_t, ship_w, ship_equal_weights, ship_refs, ship_thresholds),
  heading_payload("weak", "弱约束候选", x_weak, ship_plant, ship_t, ship_w, ship_equal_weights, ship_refs, ship_thresholds),
  heading_payload("constrained", "带约束可用解", x_constrained, ship_plant, ship_t, ship_w, ship_equal_weights, ship_refs, ship_thresholds)
};

payload.same_weight = struct();
payload.same_weight.weight_label = "[0.30, 0.30, 0.20, 0.20]";
payload.same_weight.entries = {
  heading_payload("same_weight_initial", "4-3 起始方案", ship_x0, ship_plant, ship_t, ship_w, ship_balanced_weights, ship_refs, ship_thresholds),
  heading_payload("same_weight_unconstrained", "同权重无约束解", ship_balanced_unconstrained_x, ship_plant, ship_t, ship_w, ship_balanced_weights, ship_refs, ship_thresholds),
  heading_payload("same_weight_constrained", "同权重带约束解", ship_balanced_constrained_x, ship_plant, ship_t, ship_w, ship_balanced_weights, ship_refs, ship_thresholds)
};

payload.weight_sweep = struct();
payload.weight_sweep.entries = ship_weight_entries;

payload.structure_case = struct();
payload.structure_case.plant_tex = "P_h(s)=0.01715/[s(s+0.1)(s+2.14375)]";
payload.structure_case.weight_label = "[0.30, 0.30, 0.20, 0.20]";
payload.structure_case.entries = {
  structure_payload(
    "structure_leadlag",
    "优化超前结构",
    structure_leadlag_x,
    @heading_controller_from_x,
    @vector_to_struct,
    @(x) sprintf("C_{LL}^{\\star}(s)=%.4f(%.4fs+1)/(%.4fs+1)", x(1), x(2), x(2) * x(3)),
    ship_plant,
    ship_t,
    ship_w,
    structure_weights,
    ship_refs,
    ship_thresholds
  ),
  structure_payload(
    "structure_pid",
    "优化 PID",
    structure_pid_x,
    @structure_pid_controller_from_x,
    @structure_pid_params,
    @(x) sprintf("C_{PID}^{\\star}(s)=%.4f(1+1/(%.4fs)+%.4fs/(%.4fs+1))", x(1), x(2), x(3), x(3) / 20),
    ship_plant,
    ship_t,
    ship_w,
    structure_weights,
    ship_refs,
    ship_thresholds
  )
};

fid = fopen(out_file, "w");
if fid < 0
  error("Failed to open output file: %s", out_file);
endif
fwrite(fid, jsonencode(payload), "char");
fclose(fid);

printf("Wrote %s\n", out_file);
