pkg load control;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "4-4-diagnosis-data.json");

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

function out = step_metrics(sys, controller, plant, t)
  [y, t_out] = step(sys, t);
  y = y(:);
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

  [gm, pm, wg, wc] = margin(controller * plant);
  control_tf = feedback(controller, plant);
  [u, ~] = step(control_tf, t);
  u = u(:);

  out = struct();
  out.final_value = final_value;
  out.overshoot = overshoot;
  out.settling_time = settling_time;
  out.phase_margin = pm;
  out.crossover = wc;
  out.control_peak = max(abs(u));
endfunction

s = tf("s");

ship_plant = 0.01715 / (s * (s + 0.1) * (s + 2.14375));
ship_t = 0:0.05:200;
ship_limit = 15;
ship_w = logspace(-3, 1, 600);

ship_controllers = {
  struct("id", "baseline", "label", "比例基线", "diagnosis", "参照基线", "tf", 2.25),
  struct("id", "lf_only", "label", "仅补低频", "diagnosis", "结构覆盖不足", "tf", 1.5 * (2 * s + 1) / (6 * s + 1)),
  struct("id", "aggressive", "label", "方向过激", "diagnosis", "控制量先撞约束", "tf", 5 * (10 * s + 1) / (2 * s + 1)),
  struct("id", "repair", "label", "最小修正", "diagnosis", "诊断后可接受起点", "tf", 3 * (10 * s + 1) / (5 * s + 1))
};

ship = struct();
ship.controllers = {};
for i = 1:numel(ship_controllers)
  item = ship_controllers{i};
  closed_loop = feedback(item.tf * ship_plant, 1);
  control_loop = feedback(item.tf, ship_plant);
  metrics = step_metrics(closed_loop, item.tf, ship_plant, ship_t);

  entry = struct();
  entry.id = item.id;
  entry.label = item.label;
  entry.diagnosis = item.diagnosis;
  entry.response = response_to_struct(ship_t, step(closed_loop, ship_t));
  entry.control = response_to_struct(ship_t, step(control_loop, ship_t));
  entry.open_loop = freqresp_to_struct(item.tf * ship_plant, ship_w);
  entry.metrics = metrics;
  ship.controllers{end + 1} = entry;
endfor
ship.limit = ship_limit;
ship.plant_tex = "P_h(s)=0.01715/[s(s+0.1)(s+2.14375)]";

roll_t = 0:0.05:80;
roll_w = logspace(-2, 1, 500);
roll_resonance = 0.681816;
roll_plant = 1 / (2.052 * s^2 + 0.3929 * s + 1);
roll_scale = 2;
roll_controller = roll_scale * (2.052 * s^2 + 0.3929 * s + 1) / s;
roll_sensor = s;
roll_closed = feedback(roll_plant, roll_sensor * roll_controller);

disturbance = sin(roll_resonance * roll_t);
roll_open_y = lsim(roll_plant, disturbance, roll_t);
roll_closed_y = lsim(roll_closed, disturbance, roll_t);

open_resp = squeeze(freqresp(roll_plant, roll_w));
closed_resp = squeeze(freqresp(roll_closed, roll_w));
[open_peak, open_idx] = max(abs(open_resp));
[closed_peak, closed_idx] = max(abs(closed_resp));

roll = struct();
roll.open_loop = freqresp_to_struct(roll_plant, roll_w);
roll.closed_loop = freqresp_to_struct(roll_closed, roll_w);
roll.time_open = response_to_struct(roll_t, roll_open_y);
roll.time_closed = response_to_struct(roll_t, roll_closed_y);
roll.resonance = struct(
  "open_peak", open_peak,
  "open_peak_db", 20 * log10(open_peak),
  "open_w", roll_w(open_idx),
  "closed_peak", closed_peak,
  "closed_peak_db", 20 * log10(closed_peak),
  "closed_w", roll_w(closed_idx),
  "amplitude_ratio", closed_peak / open_peak
);
roll.disturbance_tex = "M_k=2\\varphi+0.7858\\dot{\\varphi}+4.104\\ddot{\\varphi}";

payload = struct();
payload.ship = ship;
payload.roll = roll;

fid = fopen(out_file, "w");
if fid < 0
  error("Failed to open output file: %s", out_file);
endif
fwrite(fid, jsonencode(payload), "char");
fclose(fid);

printf("Wrote %s\n", out_file);
