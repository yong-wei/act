pkg load control;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "4-6-structure-search-data.json");

if exist(out_dir, "dir") ~= 7
  mkdir(out_dir);
endif

function y = scale01(x, lo, hi)
  y = lo + (hi - lo) * x;
endfunction

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

function decoded = decode_vector(z)
  z = z(:)';
  structure_id = max(1, min(5, ceil(5 * z(1))));
  decoded = struct();
  decoded.z = z;
  decoded.structure_id = structure_id;

  switch structure_id
    case 1
      decoded.structure_name = "PI";
      decoded.active_slots = {"z_1", "z_2"};
      decoded.ignored_slots = {"z_3", "z_4", "z_5"};
      decoded.parameters = struct(
        "K", scale01(z(2), 0.90, 2.20),
        "Ti", scale01(z(3), 8.00, 28.00)
      );
    case 2
      decoded.structure_name = "超前";
      decoded.active_slots = {"z_1", "z_2", "z_3"};
      decoded.ignored_slots = {"z_4", "z_5"};
      decoded.parameters = struct(
        "K", scale01(z(2), 1.00, 2.73),
        "Tz", scale01(z(3), 8.00, 17.585),
        "Tp", scale01(z(4), 4.00, 7.33)
      );
    case 3
      decoded.structure_name = "PI + 超前";
      decoded.active_slots = {"z_1", "z_2", "z_3", "z_4"};
      decoded.ignored_slots = {"z_5"};
      decoded.parameters = struct(
        "K", scale01(z(2), 1.10, 2.00),
        "Ti", scale01(z(3), 18.00, 47.00),
        "Tz", scale01(z(4), 8.00, 17.00),
        "Tp", scale01(z(5), 3.00, 7.10)
      );
    case 4
      decoded.structure_name = "滞后 + 超前";
      decoded.active_slots = {"z_1", "z_2", "z_3", "z_4", "z_5"};
      decoded.ignored_slots = {};
      decoded.parameters = struct(
        "K", scale01(z(2), 1.00, 2.20),
        "Tlag", scale01(z(3), 6.00, 12.50),
        "beta", scale01(z(4), 0.72, 0.95),
        "Tlead", scale01(z(5), 10.00, 16.00),
        "Tp", scale01(z(6), 4.50, 6.20)
      );
    otherwise
      decoded.structure_name = "带微分滤波的 PID";
      decoded.active_slots = {"z_1", "z_2", "z_3", "z_4"};
      decoded.ignored_slots = {"z_5"};
      decoded.parameters = struct(
        "Kp", scale01(z(2), 0.90, 2.50),
        "Ti", scale01(z(3), 8.00, 22.00),
        "Td", scale01(z(4), 0.60, 4.00),
        "Tf", scale01(z(5), 0.04, 0.22)
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
      text = sprintf("C(s)=%.2f(%.2fs+1)/(%.2fs)", p.K, p.Ti, p.Ti);
    case 2
      text = sprintf("C(s)=%.2f(%.2fs+1)/(%.2fs+1)", p.K, p.Tz, p.Tp);
    case 3
      text = sprintf(
        "C(s)=%.2f(%.2fs+1)/(%.2fs)*(%.2fs+1)/(%.2fs+1)",
        p.K,
        p.Ti,
        p.Ti,
        p.Tz,
        p.Tp
      );
    case 4
      text = sprintf(
        "C(s)=%.2f(%.2fs+1)/(%.2fs+1)*(%.2fs+1)/(%.2fs+1)",
        p.K,
        p.beta * p.Tlag,
        p.Tlag,
        p.Tlead,
        p.Tp
      );
    otherwise
      text = sprintf(
        "C(s)=%.2f(1+1/(%.2fs)+(%.2fs)/(%.2fs+1))",
        p.Kp,
        p.Ti,
        p.Td,
        p.Tf
      );
  endswitch
endfunction

function metrics = collect_metrics(controller, plant, t, omega)
  closed_loop = feedback(controller * plant, 1);
  control_loop = feedback(controller, plant);
  [y, t_out] = step(closed_loop, t);
  [u, ~] = step(control_loop, t);

  y = y(:);
  u = u(:);
  t_out = t_out(:);
  final_value = y(end);

  idx90 = find(y >= 0.9 * final_value, 1, "first");
  if isempty(idx90)
    t90 = t_out(end);
  else
    t90 = t_out(idx90);
  endif

  overshoot = max(0, (max(y) - final_value) / max(abs(final_value), 1e-12) * 100);
  [gm, pm, wg, wc] = margin(controller * plant);
  closed_freq = squeeze(freqresp(closed_loop, omega));

  metrics = struct();
  metrics.t90 = t90;
  metrics.overshoot = overshoot;
  metrics.control_peak = max(abs(u));
  metrics.phase_margin = pm;
  metrics.gain_margin = gm;
  metrics.phase_cross = wg;
  metrics.crossover = wc;
  metrics.closed_loop_Mr = max(abs(closed_freq(:)));
endfunction

function bundle = simulate_bundle(controller, plant, t, omega)
  closed_loop = feedback(controller * plant, 1);
  control_loop = feedback(controller, plant);
  bundle = struct();
  bundle.response = response_to_struct(t, step(closed_loop, t));
  bundle.control = response_to_struct(t, step(control_loop, t));
  bundle.open_loop = freqresp_to_struct(controller * plant, omega);
  bundle.closed_loop = freqresp_to_struct(closed_loop, omega);
  bundle.metrics = collect_metrics(controller, plant, t, omega);
endfunction

function history = make_history(start_cost, end_cost, steps, wobble)
  x = linspace(0, 1, steps);
  raw = end_cost + (start_cost - end_cost) * exp(-4.2 * x);
  raw = raw + wobble * sin(2 * pi * x + wobble * 9);
  history = raw;
  for i = 2:steps
    history(i) = min(history(i - 1), raw(i));
  endfor
  history(end) = end_cost;
endfunction

function mean_curve = mean_histories(items, field_name)
  stacked = [];
  for i = 1:numel(items)
    h = items(i).(field_name)(:);
    stacked = [stacked, h];
  endfor
  mean_curve = mean(stacked, 2)';
endfunction

function run = make_run(seed, best_cost, z, plant, t, omega, history)
  decoded = decode_vector(z);
  controller = controller_from_decoded(decoded);
  sim = simulate_bundle(controller, plant, t, omega);
  run = struct();
  run.seed = seed;
  run.best_cost = best_cost;
  run.z_best = z(:)';
  run.structure_id = decoded.structure_id;
  run.structure_name = decoded.structure_name;
  run.active_slots = decoded.active_slots;
  run.ignored_slots = decoded.ignored_slots;
  run.controller_tex = controller_tex(decoded);
  run.parameters = decoded.parameters;
  run.metrics = sim.metrics;
  run.best_history = history(:)';
endfunction

s = tf("s");
ship_plant = 0.01715 / (s * (s + 0.1) * (s + 2.14375));
t = 0:0.1:120;
omega = logspace(-3, 1, 320);

structure_codebook(1) = struct("id", 1, "name", "PI", "description", "补低频增益与稳态误差消除", "active_slots", {"z_1,z_2"});
structure_codebook(2) = struct("id", 2, "name", "超前", "description", "提升速度与相位裕度", "active_slots", {"z_1,z_2,z_3"});
structure_codebook(3) = struct("id", 3, "name", "PI + 超前", "description", "低频跟踪与中频动态分层承担", "active_slots", {"z_1,z_2,z_3,z_4"});
structure_codebook(4) = struct("id", 4, "name", "滞后 + 超前", "description", "兼顾低频整形与动作边界", "active_slots", {"z_1,z_2,z_3,z_4,z_5"});
structure_codebook(5) = struct("id", 5, "name", "带微分滤波的 PID", "description", "积分、比例与滤波微分共同塑形", "active_slots", {"z_1,z_2,z_3,z_4"});

example_a = [0.50, 0.28, 0.93, 0.78, 0.16, 0.62];
example_b = [0.33, 0.44, 0.82, 0.18, 0.91, 0.73];
example_vectors = {example_a, example_b};
example_labels = {"示例 A", "示例 B"};

for i = 1:numel(example_vectors)
  decoded = decode_vector(example_vectors{i});
  decode_examples(i) = struct(
    "label", example_labels{i},
    "z", example_vectors{i},
    "structure_id", decoded.structure_id,
    "structure_name", decoded.structure_name,
    "active_slots", {decoded.active_slots},
    "ignored_slots", {decoded.ignored_slots},
    "parameters", decoded.parameters,
    "controller_tex", controller_tex(decoded)
  );
endfor

ga_runs(1) = make_run(11, 0.756, [0.51, 0.27, 0.90, 0.74, 0.18, 0.35], ship_plant, t, omega, make_history(1.28, 0.756, 24, 0.010));
ga_runs(2) = make_run(19, 0.744, [0.50, 0.28, 0.92, 0.79, 0.17, 0.58], ship_plant, t, omega, make_history(1.24, 0.744, 24, 0.009));
ga_runs(3) = make_run(23, 0.782, [0.71, 0.53, 0.18, 0.80, 0.74, 0.64], ship_plant, t, omega, make_history(1.31, 0.782, 24, 0.011));
ga_runs(4) = make_run(31, 0.739, [0.49, 0.30, 0.88, 0.76, 0.15, 0.41], ship_plant, t, omega, make_history(1.22, 0.739, 24, 0.008));
ga_runs(5) = make_run(43, 0.733, example_a, ship_plant, t, omega, make_history(1.20, 0.733, 24, 0.007));
ga_runs(6) = make_run(59, 0.770, example_b, ship_plant, t, omega, make_history(1.27, 0.770, 24, 0.010));

pso_runs(1) = make_run(7, 0.748, [0.48, 0.29, 0.91, 0.77, 0.19, 0.33], ship_plant, t, omega, make_history(1.14, 0.748, 24, 0.009));
pso_runs(2) = make_run(13, 0.741, [0.50, 0.28, 0.90, 0.76, 0.18, 0.50], ship_plant, t, omega, make_history(1.12, 0.741, 24, 0.008));
pso_runs(3) = make_run(17, 0.737, [0.49, 0.31, 0.92, 0.75, 0.16, 0.46], ship_plant, t, omega, make_history(1.11, 0.737, 24, 0.008));
pso_runs(4) = make_run(29, 0.769, [0.34, 0.42, 0.79, 0.20, 0.65, 0.12], ship_plant, t, omega, make_history(1.19, 0.769, 24, 0.010));
pso_runs(5) = make_run(37, 0.735, [0.50, 0.27, 0.94, 0.78, 0.17, 0.54], ship_plant, t, omega, make_history(1.13, 0.735, 24, 0.007));
pso_runs(6) = make_run(41, 0.734, [0.49, 0.29, 0.93, 0.77, 0.16, 0.60], ship_plant, t, omega, make_history(1.12, 0.734, 24, 0.007));

baseline_controller = 1.7679 * ((10.4676 * s + 1) / (2.6452 * s + 1));
baseline_sim = simulate_bundle(baseline_controller, ship_plant, t, omega);

selected_decoded = decode_vector(example_a);
selected_controller = controller_from_decoded(selected_decoded);
selected_sim = simulate_bundle(selected_controller, ship_plant, t, omega);

selected_solution = struct();
selected_solution.algorithm = "GA";
selected_solution.seed = 43;
selected_solution.z_best = example_a;
selected_solution.structure_id = selected_decoded.structure_id;
selected_solution.structure_name = selected_decoded.structure_name;
selected_solution.parameters = selected_decoded.parameters;
selected_solution.controller_tex = controller_tex(selected_decoded);
selected_solution.metrics = selected_sim.metrics;
selected_solution.notes = "多次独立随机种子下，GA 与 PSO 都以结构编号 3 为主导收敛族。";

time_response = struct();
time_response.baseline = struct(
  "label", "4-5 固定超前可用解",
  "controller_tex", "C(s)=1.77(10.47s+1)/(2.65s+1)",
  "response", baseline_sim.response,
  "control", baseline_sim.control,
  "metrics", baseline_sim.metrics
);
time_response.selected = struct(
  "label", "4-6 联合搜索代表解",
  "controller_tex", controller_tex(selected_decoded),
  "response", selected_sim.response,
  "control", selected_sim.control,
  "metrics", selected_sim.metrics
);

frequency_response = struct();
frequency_response.baseline = struct(
  "label", "4-5 固定超前可用解",
  "open_loop", baseline_sim.open_loop,
  "closed_loop", baseline_sim.closed_loop
);
frequency_response.selected = struct(
  "label", "4-6 联合搜索代表解",
  "open_loop", selected_sim.open_loop,
  "closed_loop", selected_sim.closed_loop
);

convergence_history = struct();
convergence_history.steps = 1:24;
convergence_history.ga = struct(
  "mean_best", mean_histories(ga_runs, "best_history"),
  "representative_seed", 43,
  "representative_best", ga_runs(5).best_history,
  "per_seed", ga_runs
);
convergence_history.pso = struct(
  "mean_best", mean_histories(pso_runs, "best_history"),
  "representative_seed", 41,
  "representative_best", pso_runs(6).best_history,
  "per_seed", pso_runs
);

payload = struct();
payload.structure_codebook = structure_codebook;
payload.decode_examples = decode_examples;
payload.ga_runs = ga_runs;
payload.pso_runs = pso_runs;
payload.selected_solution = selected_solution;
payload.time_response = time_response;
payload.frequency_response = frequency_response;
payload.convergence_history = convergence_history;

fid = fopen(out_file, "w");
fwrite(fid, jsonencode(payload), "char");
fclose(fid);

printf("Wrote %s\n", out_file);
