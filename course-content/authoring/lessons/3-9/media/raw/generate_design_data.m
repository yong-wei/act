pkg load control;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "3-9-design-data.json");

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

function out = root_locus_to_struct(sys, k_values)
  [num, den] = tfdata(sys, "vector");
  num = num(:)';
  den = den(:)';
  if length(num) < length(den)
    num = [zeros(1, length(den) - length(num)), num];
  elseif length(den) < length(num)
    den = [zeros(1, length(num) - length(den)), den];
  endif

  root_count = length(den) - 1;
  roots_matrix = zeros(root_count, length(k_values));
  for idx = 1:length(k_values)
    coeffs = den + k_values(idx) * num;
    roots_matrix(:, idx) = roots(coeffs);
  endfor

  out = struct();
  out.k = k_values(:)';
  out.real = real(roots_matrix);
  out.imag = imag(roots_matrix);
endfunction

function out = bode_to_struct(sys, omega)
  resp = squeeze(freqresp(sys, omega));
  out = struct();
  out.w = omega(:)';
  out.mag_db = (20 * log10(abs(resp(:))))';
  out.phase_deg = (unwrap(arg(resp(:)))' * 180 / pi);
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
endfunction

function out = margins_to_struct(sys)
  [gm, pm, wg, wc] = margin(sys);
  out = struct();
  out.gm = gm;
  out.gm_db = 20 * log10(gm);
  out.pm = pm;
  out.wg = wg;
  out.wc = wc;
endfunction

function out = forced_to_struct(sys, t, u)
  [y, t_out] = lsim(sys, u, t);
  out = struct();
  out.t = t_out(:)';
  out.y = y(:)';
endfunction

function out = variant_payload(id, title, task_tag, emphasis, controller, loop_shape, k_ref, time_mode, t_step, t_ramp, omega)
  loop = controller;
  closed = feedback(loop, 1);
  [num_l, den_l] = tfdata(loop / k_ref, "vector");
  rl_sys = tf(num_l, den_l);

  [step_resp, ~] = step(feedback(loop, 1), t_step);
  step_metrics_block = step_metrics(closed, t_step, 0.02);
  ramp_out = forced_to_struct(closed, t_ramp, t_ramp);
  ramp_err = struct();
  ramp_err.t = ramp_out.t;
  ramp_err.y = t_ramp(:)' - ramp_out.y;

  entry = struct();
  entry.id = id;
  entry.title = title;
  entry.task_tag = task_tag;
  entry.emphasis = emphasis;
  entry.k_ref = k_ref;
  entry.time_mode = time_mode;
  entry.open_loop_poles = complex_vector_to_struct(pole(loop));
  entry.open_loop_zeros = complex_vector_to_struct(zero(loop));
  entry.closed_loop_poles = complex_vector_to_struct(pole(closed));
  entry.root_locus = root_locus_to_struct(rl_sys, linspace(0, max(4 * k_ref, 6), 260));
  entry.bode = bode_to_struct(loop, omega);
  entry.margins = margins_to_struct(loop);
  entry.step = response_to_struct(t_step, step_resp);
  entry.step_metrics = step_metrics_block;
  entry.ramp_output = ramp_out;
  entry.ramp_error = ramp_err;
  entry.ramp_error_100 = interp1(ramp_err.t, ramp_err.y, 100);
  entry.ramp_error_200 = interp1(ramp_err.t, ramp_err.y, 200);
  entry.ramp_error_400 = interp1(ramp_err.t, ramp_err.y, 400);
  out = entry;
endfunction

s = tf("s");
P = 0.01715 / (s * (s + 0.1) * (s + 2.14375));
omega = logspace(-3, 1, 1200);
t_step = linspace(0, 180, 2200);
t_ramp = linspace(0, 400, 2400);

payload = struct();
payload.lesson_id = "3-9";
payload.plant_tex = "P(s)=0.01715/[s(s+0.1)(s+2.14375)]";
payload.variants = struct();

C_baseline = 2.25;
C_zero_line = 2.25 * ((s / 0.08) + 1) / ((s / 0.5) + 1);
C_pi_weak = 2.25 * (1 + 1 / (200 * s));
C_pi_strong = 2.25 * (1 + 1 / (40 * s));
C_pi_corrected = 2.25 * (1 + 1 / (40 * s)) * ((s / 0.05) + 1) / ((s / 0.5) + 1);
C_lag = 2.25 * 2 * ((40 * s) + 1) / ((80 * s) + 1);

payload.variants.baseline = variant_payload(
  "baseline",
  "基准版本",
  "综合折中基线",
  "先建立统一锚点",
  C_baseline * P,
  P,
  2.25,
  "step",
  t_step,
  t_ramp,
  omega
);

payload.variants.zero_line = variant_payload(
  "zero_line",
  "零点线补强",
  "更偏动态改善",
  "优先整理中频相位与主导极点",
  C_zero_line * P,
  ((s / 0.08) + 1) / ((s / 0.5) + 1) * P,
  2.25,
  "step",
  t_step,
  t_ramp,
  omega
);

payload.variants.pi_weak = variant_payload(
  "pi_weak",
  "弱积分",
  "稳态改善试探",
  "先看误差开始下降，同时暴露慢极点",
  C_pi_weak * P,
  (1 + 1 / (200 * s)) * P,
  2.25,
  "ramp_error",
  t_step,
  t_ramp,
  omega
);

payload.variants.pi_strong = variant_payload(
  "pi_strong",
  "强积分",
  "稳态收益更彻底",
  "低频收益最强，但相位代价也最明显",
  C_pi_strong * P,
  (1 + 1 / (40 * s)) * P,
  2.25,
  "ramp_error",
  t_step,
  t_ramp,
  omega
);

payload.variants.pi_corrected = variant_payload(
  "pi_corrected",
  "积分校正",
  "综合折中路线",
  "保留积分任务，同时把动态和裕度拉回可用区",
  C_pi_corrected * P,
  (1 + 1 / (40 * s)) * ((s / 0.05) + 1) / ((s / 0.5) + 1) * P,
  2.25,
  "ramp_error",
  t_step,
  t_ramp,
  omega
);

payload.variants.lag = variant_payload(
  "lag",
  "滞后对照",
  "温和稳态改善",
  "抬高低频但不改变型别",
  C_lag * P,
  2 * ((40 * s) + 1) / ((80 * s) + 1) * P,
  2.25,
  "ramp_error",
  t_step,
  t_ramp,
  omega
);

payload.summary_cards = {
  struct("title", "基准", "line1", "超调 31.95%，调节 83.04 s", "line2", "PM 37.43°，斜坡误差 5.56"),
  struct("title", "零点线补强", "line1", "超调 0.43%，调节 26.95 s", "line2", "PM 67.58°，斜坡误差仍约 5.56"),
  struct("title", "弱积分", "line1", "400 s 时斜坡误差约 0.71", "line2", "PM 34.97°，慢极点开始显现"),
  struct("title", "强积分", "line1", "200 s 时斜坡误差近 0", "line2", "PM 25.09°，超调升至 56.69%"),
  struct("title", "积分校正", "line1", "200 s 时斜坡误差约 0.03", "line2", "PM 55.77°，超调回落到 11.93%"),
  struct("title", "滞后", "line1", "斜坡误差降到约 2.78", "line2", "PM 31.20°，但型别不变")
};

fid = fopen(out_file, "w");
if fid < 0
  error("Cannot open output file: %s", out_file);
endif
fputs(fid, jsonencode(payload));
fclose(fid);

printf("Wrote %s\n", out_file);
