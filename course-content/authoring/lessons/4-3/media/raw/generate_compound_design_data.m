pkg load control;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "4-3-compound-design-data.json");

if exist(out_dir, "dir") ~= 7
  mkdir(out_dir);
endif

function out = response_to_struct(t, y)
  out = struct();
  out.t = t(:)';
  out.y = y(:)';
endfunction

function out = complex_vector_to_struct(values)
  values = values(:);
  out = struct();
  out.real = real(values)';
  out.imag = imag(values)';
endfunction

function write_complex_points_csv(path, values)
  fid = fopen(path, "w");
  if fid < 0
    error("Cannot open output file: %s", path);
  endif
  fprintf(fid, "re,im\n");
  values = values(:);
  for idx = 1:numel(values)
    fprintf(fid, "%.12f,%.12f\n", real(values(idx)), imag(values(idx)));
  endfor
  fclose(fid);
endfunction

function gain_max = expand_root_locus_gain(sys, initial_gain_max, endpoint_tol)
  gain_max = initial_gain_max;
  finite_zeros = zero(sys)(:);
  if isempty(finite_zeros)
    return;
  endif

  while true
    poles_now = pole(feedback(gain_max * sys, 1))(:);
    covered = true;
    for idx = 1:numel(finite_zeros)
      if min(abs(poles_now - finite_zeros(idx))) > endpoint_tol
        covered = false;
        break;
      endif
    endfor
    if covered
      break;
    endif
    gain_max = gain_max * 2;
    if gain_max > 1e6
      error("Adaptive root-locus gain search exceeded safety bound.");
    endif
  endwhile
endfunction

function export_root_locus_samples(out_dir, variant_id, sys, initial_gain_max, sample_count)
  gain_max = expand_root_locus_gain(sys, initial_gain_max, 5e-4);
  gain_step = gain_max / (sample_count - 1);
  [rldata, ~] = rlocus(sys, gain_step, 0, gain_max);

  fid = fopen(fullfile(out_dir, strcat(variant_id, "_root_locus_raw_samples.csv")), "w");
  if fid < 0
    error("Cannot open root-locus sample output for variant: %s", variant_id);
  endif
  fprintf(fid, "sample_idx,gain,re,im\n");
  for sample_idx = 1:columns(rldata)
    for root_idx = 1:rows(rldata)
      fprintf(
        fid,
        "%d,%.12f,%.12f,%.12f\n",
        sample_idx - 1,
        (sample_idx - 1) * gain_step,
        real(rldata(root_idx, sample_idx)),
        imag(rldata(root_idx, sample_idx))
      );
    endfor
  endfor
  fclose(fid);

  write_complex_points_csv(fullfile(out_dir, strcat(variant_id, "_open_loop_poles.csv")), pole(sys));
  write_complex_points_csv(fullfile(out_dir, strcat(variant_id, "_open_loop_zeros.csv")), zero(sys));
endfunction

function out = bode_to_struct(sys, omega)
  resp = squeeze(freqresp(sys, omega));
  out = struct();
  out.w = omega(:)';
  out.mag_db = (20 * log10(abs(resp(:))))';
  out.phase_deg = (unwrap(angle(resp(:)))' * 180 / pi);
endfunction

function metrics = step_metrics(sys, t, tol)
  [y, t_out] = step(sys, t);
  y = y(:);
  t_out = t_out(:);
  final_value = y(end);
  overshoot = max(0, (max(y) - final_value) / max(abs(final_value), 1e-12) * 100);
  [~, peak_idx] = max(y);

  idx10 = find(y >= 0.1 * final_value, 1, "first");
  idx90 = find(y >= 0.9 * final_value, 1, "first");
  if isempty(idx10) || isempty(idx90)
    rise_time = NaN;
  else
    rise_time = t_out(idx90) - t_out(idx10);
  endif

  out_of_band = find(abs(y - final_value) > tol * max(abs(final_value), 1e-12));
  if isempty(out_of_band)
    settling_time = t_out(1);
  else
    last_out = out_of_band(end);
    if last_out < length(t_out)
      settling_time = t_out(last_out + 1);
    else
      settling_time = t_out(end);
    endif
  endif

  metrics = struct();
  metrics.overshoot = overshoot;
  metrics.peak_time = t_out(peak_idx);
  metrics.settling_time = settling_time;
  metrics.rise_time = rise_time;
  metrics.final_value = final_value;
  metrics.steady_state_error = abs(1 - final_value);
endfunction

function out = margins_to_struct(sys)
  [gm, pm, wg, wc] = margin(sys);
  out = struct();
  out.gm = gm;
  if isfinite(gm) && gm > 0
    out.gm_db = 20 * log10(gm);
  else
    out.gm_db = Inf;
  endif
  out.pm = pm;
  out.wg = wg;
  out.wc = wc;
endfunction

function peak = control_peak(control_tf, t)
  [u, ~] = step(control_tf, t);
  peak = max(abs(u(:)));
endfunction

function entry = design_demo_payload(out_dir, id, title, suitable_when, goal_lines, plant_tex, controller_tex, plant, controller, omega, t)
  loop_before = plant;
  loop_after = controller * plant;
  closed_before = feedback(loop_before, 1);
  closed_after = feedback(loop_after, 1);

  export_root_locus_samples(out_dir, strcat(id, "_before"), loop_before, 30, 320);
  export_root_locus_samples(out_dir, strcat(id, "_after"), loop_after, 30, 320);

  entry = struct();
  entry.id = id;
  entry.title = title;
  entry.suitable_when = suitable_when;
  entry.goal_lines = goal_lines;
  entry.plant_tex = plant_tex;
  entry.controller_tex = controller_tex;
  entry.step_before = response_to_struct(t, step(closed_before, t));
  entry.step_after = response_to_struct(t, step(closed_after, t));
  entry.metrics_before = step_metrics(closed_before, t, 0.02);
  entry.metrics_after = step_metrics(closed_after, t, 0.02);
  entry.metrics_before.control_peak = control_peak(feedback(1, plant), t);
  entry.metrics_after.control_peak = control_peak(feedback(controller, plant), t);
  entry.margins_before = margins_to_struct(loop_before);
  entry.margins_after = margins_to_struct(loop_after);
  entry.bode_plant = bode_to_struct(plant, omega);
  entry.bode_controller = bode_to_struct(controller, omega);
  entry.bode_loop_after = bode_to_struct(loop_after, omega);
  entry.before_closed_poles = complex_vector_to_struct(pole(closed_before));
  entry.after_closed_poles = complex_vector_to_struct(pole(closed_after));
  entry.before_open_loop_poles = complex_vector_to_struct(pole(loop_before));
  entry.before_open_loop_zeros = complex_vector_to_struct(zero(loop_before));
  entry.after_open_loop_poles = complex_vector_to_struct(pole(loop_after));
  entry.after_open_loop_zeros = complex_vector_to_struct(zero(loop_after));
endfunction

function entry = heading_case_payload(out_dir, omega, t)
  s = tf("s");
  plant = 0.01715 / (s * (s + 0.1) * (s + 2.14375));

  zeta_target = 0.46;
  ts_target = 40.0;
  wc_target = 0.18;
  phi_deg = 25.0;
  alpha = (1 - sin(phi_deg * pi / 180)) / (1 + sin(phi_deg * pi / 180));
  T_lead = 10.0;
  shape = (T_lead * s + 1) / (alpha * T_lead * s + 1);
  K = 1 / abs(squeeze(freqresp(shape * plant, wc_target)));
  controller = K * shape;

  loop_before = plant;
  loop_after = controller * plant;
  closed_before = feedback(loop_before, 1);
  closed_after = feedback(loop_after, 1);

  export_root_locus_samples(out_dir, "heading_case_before", loop_before, 25, 320);
  export_root_locus_samples(out_dir, "heading_case_after", loop_after, 25, 320);

  entry = struct();
  entry.id = "heading_case";
  entry.title = "工程案例：客船航向保持的超前初始方案";
  entry.goal_lines = {
    "超调量控制在 20% 以内，避免修航过程明显越摆",
    "调节时间压到 40 s 左右，缩短长时间修航",
    "控制峰值控制在 7 以内，避免舵角动作过激"
  };
  entry.plant_tex = "P_h(s)=0.01715/[s(s+0.1)(s+2.14375)]";
  entry.controller_tex = "C_h(s)=2.782(10s+1)/(4s+1)";
  entry.design = struct(
    "zeta_target", zeta_target,
    "ts_target", ts_target,
    "wn_min", 4 / (zeta_target * ts_target),
    "sigma_min", 4 / ts_target,
    "wc_target", wc_target,
    "phi_deg", phi_deg,
    "alpha", alpha,
    "T_lead", T_lead,
    "K", K
  );
  entry.step_before = response_to_struct(t, step(closed_before, t));
  entry.step_after = response_to_struct(t, step(closed_after, t));
  entry.metrics_before = step_metrics(closed_before, t, 0.02);
  entry.metrics_after = step_metrics(closed_after, t, 0.02);
  entry.metrics_before.control_peak = control_peak(feedback(1, plant), t);
  entry.metrics_after.control_peak = control_peak(feedback(controller, plant), t);
  entry.margins_before = margins_to_struct(loop_before);
  entry.margins_after = margins_to_struct(loop_after);
  entry.bode_plant = bode_to_struct(plant, omega);
  entry.bode_controller = bode_to_struct(controller, omega);
  entry.bode_loop_after = bode_to_struct(loop_after, omega);
  entry.before_closed_poles = complex_vector_to_struct(pole(closed_before));
  entry.after_closed_poles = complex_vector_to_struct(pole(closed_after));
  entry.before_open_loop_poles = complex_vector_to_struct(pole(loop_before));
  entry.before_open_loop_zeros = complex_vector_to_struct(zero(loop_before));
  entry.after_open_loop_poles = complex_vector_to_struct(pole(loop_after));
  entry.after_open_loop_zeros = complex_vector_to_struct(zero(loop_after));
endfunction

function entry = roll_boundary_payload(omega, t)
  s = tf("s");
  plant = 1 / (2.052 * s^2 + 0.3929 * s + 1);
  controller = 2 * (2.052 * s^2 + 0.3929 * s + 1) / s;
  closed = feedback(plant, s * controller);

  disturbance = (1 - exp(-0.18 * t)) .* sin(0.681816 * t) + 0.18 * sin(1.35 * t);
  y_open = lsim(plant, disturbance, t);
  y_closed = lsim(closed, disturbance, t);
  open_resp = squeeze(freqresp(plant, omega));
  closed_resp = squeeze(freqresp(closed, omega));
  [open_peak, open_idx] = max(abs(open_resp));
  [closed_peak, closed_idx] = max(abs(closed_resp));

  entry = struct();
  entry.id = "roll_boundary";
  entry.title = "边界案例：横摇减摇鳍首先是扰动通道重写";
  entry.plant_tex = "G_{\\varphi M_f}(s)=1/(2.052s^2+0.3929s+1)";
  entry.controller_tex = "G_c(s)=2(2.052s^2+0.3929s+1)/s";
  entry.bode_before = bode_to_struct(plant, omega);
  entry.bode_after = bode_to_struct(closed, omega);
  entry.disturbance_input = response_to_struct(t, disturbance);
  entry.time_open = response_to_struct(t, y_open);
  entry.time_closed = response_to_struct(t, y_closed);
  entry.resonance = struct(
    "open_peak_db", 20 * log10(open_peak),
    "closed_peak_db", 20 * log10(closed_peak),
    "open_w", omega(open_idx),
    "closed_w", omega(closed_idx),
    "amplitude_ratio", closed_peak / open_peak
  );
endfunction

s = tf("s");
omega_common = logspace(-3, 2, 900);
time_common = linspace(0, 30, 1800);
time_case = linspace(0, 180, 2200);
time_roll = linspace(0, 40, 1600);

payload = struct();
payload.lesson_id = "4-3";

plant_pi_lead = 1 / ((s + 1) * (0.4 * s + 1));
controller_pi_lead = 6 * (1 + 1 / (1.8 * s)) * ((0.9 * s + 1) / (0.18 * s + 1));
payload.pi_lead = design_demo_payload(
  out_dir,
  "pi_lead",
  "复合形式 1：PI + 超前",
  "既要消除稳态误差，又要把阻尼和相位储备拉回可接受范围",
  {
    "单位阶跃稳态误差压到 5% 以内",
    "超调量控制在 15% 左右",
    "截止频率提升到 2 rad/s 附近"
  },
  "P_1(s)=1/[(s+1)(0.4s+1)]",
  "C_1(s)=6(1+1/(1.8s))(0.9s+1)/(0.18s+1)",
  plant_pi_lead,
  controller_pi_lead,
  omega_common,
  time_common
);

plant_lag_lead = 1 / ((s + 1) * (0.5 * s + 1) * (0.1 * s + 1));
controller_lag_lead = 6 * ((5 * s + 1) / (20 * s + 1)) * ((0.8 * s + 1) / (0.16 * s + 1));
payload.lag_lead = design_demo_payload(
  out_dir,
  "lag_lead",
  "复合形式 2：滞后 + 超前",
  "原系统速度尚可，但静差偏大，且希望在抬升低频增益时保持足够相位余量",
  {
    "单位阶跃稳态误差压到 15% 左右",
    "相角裕度保持在 80° 以上",
    "不把动态过程推成高超调形态"
  },
  "P_2(s)=1/[(s+1)(0.5s+1)(0.1s+1)]",
  "C_2(s)=6(5s+1)(0.8s+1)/[(20s+1)(0.16s+1)]",
  plant_lag_lead,
  controller_lag_lead,
  omega_common,
  time_common
);

plant_pid = 1 / ((s + 1) * (s + 2));
controller_pid = 3.5 * (1 + 1 / (1.5 * s) + (0.25 * s) / (0.05 * s + 1));
payload.pid = design_demo_payload(
  out_dir,
  "pid",
  "复合形式 3：带微分滤波的 PID",
  "既要把静差压到零，又希望用微分环节提前整理中频相位，同时避免纯微分放大高频噪声",
  {
    "稳态误差压到零",
    "调节时间保持在 4 s 左右",
    "相角裕度维持在 60° 以上"
  },
  "P_3(s)=1/[(s+1)(s+2)]",
  "C_3(s)=3.5(1+1/(1.5s)+0.25s/(0.05s+1))",
  plant_pid,
  controller_pid,
  omega_common,
  time_common
);

payload.heading_case = heading_case_payload(out_dir, omega_common, time_case);
payload.roll_boundary = roll_boundary_payload(logspace(-2, 1, 700), time_roll);

fid = fopen(out_file, "w");
if fid < 0
  error("Failed to open output file: %s", out_file);
endif
fwrite(fid, jsonencode(payload), "char");
fclose(fid);

printf("Wrote %s\n", out_file);
