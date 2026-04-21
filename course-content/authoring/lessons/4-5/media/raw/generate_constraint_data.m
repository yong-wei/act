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

function out = heading_payload(id, label, x, plant, t, omega, thresholds)
  controller = heading_controller_from_x(x);
  closed_loop = feedback(controller * plant, 1);
  control_loop = feedback(controller, plant);
  metrics = collect_heading_metrics(controller, plant, t);

  out = struct();
  out.id = id;
  out.label = label;
  out.parameters = vector_to_struct(x);
  out.controller_tex = heading_controller_tex("C", x);
  out.response = response_to_struct(t, step(closed_loop, t));
  out.control = response_to_struct(t, step(control_loop, t));
  out.open_loop = freqresp_to_struct(controller * plant, omega);
  out.metrics = metrics;
  out.constraint_penalty = heading_constraint_penalty(metrics, thresholds);
endfunction

s = tf("s");

ship_plant = 0.01715 / (s * (s + 0.1) * (s + 2.14375));
ship_t = 0:0.1:200;
ship_w = logspace(-3, 1, 500);

thresholds = struct();
thresholds.overshoot = 20.0;
thresholds.control_peak = 7.0;
thresholds.phase_margin = 45.0;

x_initial = [2.796; 10.0; 0.406];
x_weak = [5.0; 10.0; 0.2];
x_constrained = [1.7679; 10.4676; 0.2527];

payload = struct();
payload.plant_tex = "P_h(s)=0.01715/[s(s+0.1)(s+2.14375)]";
payload.thresholds = thresholds;
payload.weight_label = "[0.25, 0.25, 0.25, 0.25]";
payload.entries = {
  heading_payload("initial", "4-3 起始方案", x_initial, ship_plant, ship_t, ship_w, thresholds),
  heading_payload("weak", "弱约束候选", x_weak, ship_plant, ship_t, ship_w, thresholds),
  heading_payload("constrained", "带约束可用解", x_constrained, ship_plant, ship_t, ship_w, thresholds)
};

fid = fopen(out_file, "w");
if fid < 0
  error("Failed to open output file: %s", out_file);
endif
fwrite(fid, jsonencode(payload), "char");
fclose(fid);

printf("Wrote %s\n", out_file);
