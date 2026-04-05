pkg load control;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "3-8-design-data.json");

if exist(out_dir, "dir") ~= 7
  mkdir(out_dir);
endif

function out = response_to_struct(t, y)
  out = struct();
  out.t = t(:)';
  out.y = y(:)';
endfunction

function out = bode_to_struct(sys, omega)
  resp = squeeze(freqresp(sys, omega));
  out = struct();
  out.w = omega(:)';
  out.mag_db = (20 * log10(abs(resp(:))))';
  out.phase_deg = (unwrap(arg(resp(:)))' * 180 / pi);
endfunction

function out = nyquist_to_struct(sys, omega)
  [re, im] = nyquist(sys, omega);
  out = struct();
  out.w = omega(:)';
  out.real = squeeze(re(:))';
  out.imag = squeeze(im(:))';
endfunction

function metrics = step_metrics(sys, t, tol)
  [y, t_out] = step(sys, t);
  y = y(:);
  t_out = t_out(:);
  final_value = y(end);
  overshoot = max(0, (max(y) - final_value) / max(abs(final_value), 1e-12) * 100);
  [~, peak_idx] = max(y);
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

function out = closed_loop_peak_to_struct(sys, omega)
  resp = squeeze(freqresp(sys, omega));
  mag = abs(resp(:));
  [mr, idx] = max(mag);
  out = struct();
  out.mr = mr;
  out.wr = omega(idx);
endfunction

function bw = estimate_bandwidth(sys, omega)
  resp = squeeze(freqresp(sys, omega));
  mag = abs(resp(:));
  threshold = mag(1) / sqrt(2);
  idx = find(mag <= threshold, 1, "first");
  if isempty(idx)
    bw = NaN;
  else
    bw = omega(idx);
  endif
endfunction

function count = rhp_pole_count(sys)
  values = pole(sys);
  count = sum(real(values) > 1e-8);
endfunction

function y = unit_step_response(sys, t)
  [yy, ~] = step(sys, t);
  y = yy(:)';
endfunction

function out = effect_payload(base_sys, new_sys, w, t, label_base, label_new, focus_text, gain_text, cost_text)
  out = struct();
  out.base_label = label_base;
  out.new_label = label_new;
  out.bode_base = bode_to_struct(base_sys, w);
  out.bode_new = bode_to_struct(new_sys, w);
  out.step_base = response_to_struct(t, unit_step_response(feedback(base_sys, 1), t));
  out.step_new = response_to_struct(t, unit_step_response(feedback(new_sys, 1), t));
  out.margin_base = margins_to_struct(base_sys);
  out.margin_new = margins_to_struct(new_sys);
  out.metrics_base = step_metrics(feedback(base_sys, 1), t, 0.02);
  out.metrics_new = step_metrics(feedback(new_sys, 1), t, 0.02);
  out.focus_text = focus_text;
  out.gain_text = gain_text;
  out.cost_text = cost_text;
endfunction

s = tf("s");
payload = struct();

w_effect = logspace(-2, 2, 700);
w_mid = logspace(-3, 3, 1200);
w_heading = logspace(-3, 1, 1200);
w_platform = logspace(-1, 3, 1200);
t_short = linspace(0, 20, 1200);
t_integral = linspace(0, 60, 1800);
t_heading = linspace(0, 250, 1800);
t_platform_fast = linspace(0, 2.5, 1800);
t_platform_slow = linspace(0, 8.0, 1800);

L0 = 1 / ((s + 0.3) * (s + 1) * (s + 3));
payload.effects = struct();
payload.effects.gain = effect_payload(
  L0, 4 * L0, w_effect, t_short,
  "基准", "4倍增益",
  "主要改写中频穿越位置",
  "截止频率右移，速度提高",
  "相角裕度下降，更靠近稳定边界"
);
payload.effects.zero = effect_payload(
  L0, L0 * (1 + s / 1.2), w_effect, t_short,
  "基准", "加入左半平面零点",
  "主要改写中频相位",
  "相位提前，动态更积极",
  "高频幅值抬升，噪声代价增加"
);
payload.effects.pole = effect_payload(
  L0, 0.5 * L0 / s, w_effect, t_integral,
  "基准", "加入积分极点",
  "先增强低频，再压缩中频余量",
  "稳态精度提高",
  "相位更早下降，超调风险上升"
);
payload.effects.rhp_zero = effect_payload(
  L0, L0 * (1 - s / 1.5), w_effect, t_short,
  "基准", "加入右半平面零点",
  "幅值与相位变化方向分离",
  "表面上更快",
  "相位代价更大，易误判"
);

payload.nyquist_quickcheck = struct();
payload.nyquist_quickcheck.cases = {};
quick_systems = {
  struct("label", "A", "title", "开环稳定，闭环稳定", "sys", 6 / ((s + 1) * (s + 2) * (s + 4)))
  struct("label", "B", "title", "P=1 但包围不足", "sys", 0.5 * (s + 0.5) / ((s - 1) * (s + 1) * (s + 3)))
  struct("label", "C", "title", "P=1 且完成一次包围", "sys", 8 * (s + 0.5) / ((s - 1) * (s + 1) * (s + 3)))
  struct("label", "D", "title", "含右半平面零点但仍稳定", "sys", 10 * (s - 0.5) / ((s + 1) * (s + 2) * (s + 8)))
};
for k = 1:numel(quick_systems)
  item = quick_systems{k};
  closed = feedback(item.sys, 1);
  entry = struct();
  entry.label = item.label;
  entry.title = item.title;
  entry.curve = nyquist_to_struct(item.sys, w_mid);
  entry.P = rhp_pole_count(item.sys);
  entry.Z = rhp_pole_count(closed);
  entry.N = entry.P - entry.Z;
  payload.nyquist_quickcheck.cases{end + 1} = entry;
endfor

L_small = 80 / ((s + 1) * (s + 2) * (s + 4));
L_large = 110 / ((s + 1) * (s + 2) * (s + 4));
payload.nyquist_compare = struct();
payload.nyquist_compare.small = nyquist_to_struct(L_small, w_mid);
payload.nyquist_compare.large = nyquist_to_struct(L_large, w_mid);
payload.nyquist_compare.small_label = "K=80";
payload.nyquist_compare.large_label = "K=110";
payload.nyquist_compare.summary = {
  "K=80 仍未包围临界点，但已明显逼近稳定边界",
  "K=110 已发生包围，闭环越过稳定边界",
  "设计时应在提速与稳定余量之间留出缓冲"
};

Lb = 5 / (s * (s + 1) * (0.5 * s + 1));
payload.bode = struct();
payload.bode.open_loop = bode_to_struct(Lb, w_effect);
payload.bode.margins = margins_to_struct(Lb);
payload.bode.phase_at_wc = interp1(log10(payload.bode.open_loop.w), payload.bode.open_loop.phase_deg, log10(payload.bode.margins.wc));
payload.bode.mag_at_wg = interp1(log10(payload.bode.open_loop.w), payload.bode.open_loop.mag_db, log10(payload.bode.margins.wg));
payload.bode.closed_loop = bode_to_struct(feedback(Lb, 1), w_effect);
payload.bode.step = response_to_struct(t_short, unit_step_response(feedback(Lb, 1), t_short));
payload.bode.metrics = step_metrics(feedback(Lb, 1), t_short, 0.02);

payload.three_band = struct();
payload.three_band.w = w_effect(:)';
band_mag = -20 * log10(1 + (w_effect / 0.3).^2).^0.25 - 20 * log10(1 + (w_effect / 2).^2).^0.2;
payload.three_band.mag_db = band_mag(:)';
payload.three_band.boundaries = [0.1, 3.0];

L_heading_base = 0.01715 * 2.25 / (s * (s + 0.1) * (s + 2.14375));
C_heading = (1 + s / 0.05) / (1 + s / 0.3);
L_heading_comp = C_heading * L_heading_base;
payload.heading_case = struct();
payload.heading_case.open_base = bode_to_struct(L_heading_base, w_heading);
payload.heading_case.open_comp = bode_to_struct(L_heading_comp, w_heading);
payload.heading_case.closed_base = bode_to_struct(feedback(L_heading_base, 1), w_heading);
payload.heading_case.closed_comp = bode_to_struct(feedback(L_heading_comp, 1), w_heading);
payload.heading_case.step_base = response_to_struct(t_heading, unit_step_response(feedback(L_heading_base, 1), t_heading));
payload.heading_case.step_comp = response_to_struct(t_heading, unit_step_response(feedback(L_heading_comp, 1), t_heading));
payload.heading_case.margin_base = margins_to_struct(L_heading_base);
payload.heading_case.margin_comp = margins_to_struct(L_heading_comp);
payload.heading_case.metrics_base = step_metrics(feedback(L_heading_base, 1), t_heading, 0.02);
payload.heading_case.metrics_comp = step_metrics(feedback(L_heading_comp, 1), t_heading, 0.02);
payload.heading_case.peak_base = closed_loop_peak_to_struct(feedback(L_heading_base, 1), w_heading);
payload.heading_case.peak_comp = closed_loop_peak_to_struct(feedback(L_heading_comp, 1), w_heading);
payload.heading_case.bandwidth_base = estimate_bandwidth(feedback(L_heading_base, 1), w_heading);
payload.heading_case.bandwidth_comp = estimate_bandwidth(feedback(L_heading_comp, 1), w_heading);

L_platform_base = 2960 * (s / 15 + 1) / ...
  (s * (s / 3 + 1) * (((1.7 * s + 1) * (0.005 * s + 1) * (0.001 * s + 1)) + 100));
L_platform_fast = 5 * L_platform_base;
L_platform_slow = 0.2 * L_platform_base;
C_platform = (1 + s / 3) / (1 + s / 12);
L_platform_comp = C_platform * L_platform_base;
payload.platform_case = struct();
payload.platform_case.fast_label = "激进基线 K=5";
payload.platform_case.slow_label = "仅降增益 K=0.2";
payload.platform_case.comp_label = "超前校正 K=1";
payload.platform_case.open_fast = bode_to_struct(L_platform_fast, w_platform);
payload.platform_case.open_slow = bode_to_struct(L_platform_slow, w_platform);
payload.platform_case.open_comp = bode_to_struct(L_platform_comp, w_platform);
payload.platform_case.closed_fast = bode_to_struct(feedback(L_platform_fast, 1), w_platform);
payload.platform_case.closed_slow = bode_to_struct(feedback(L_platform_slow, 1), w_platform);
payload.platform_case.closed_comp = bode_to_struct(feedback(L_platform_comp, 1), w_platform);
payload.platform_case.step_fast = response_to_struct(t_platform_fast, unit_step_response(feedback(L_platform_fast, 1), t_platform_fast));
payload.platform_case.step_slow = response_to_struct(t_platform_slow, unit_step_response(feedback(L_platform_slow, 1), t_platform_slow));
payload.platform_case.step_comp = response_to_struct(t_platform_fast, unit_step_response(feedback(L_platform_comp, 1), t_platform_fast));
payload.platform_case.margin_fast = margins_to_struct(L_platform_fast);
payload.platform_case.margin_slow = margins_to_struct(L_platform_slow);
payload.platform_case.margin_comp = margins_to_struct(L_platform_comp);
payload.platform_case.metrics_fast = step_metrics(feedback(L_platform_fast, 1), t_platform_fast, 0.02);
payload.platform_case.metrics_slow = step_metrics(feedback(L_platform_slow, 1), t_platform_slow, 0.02);
payload.platform_case.metrics_comp = step_metrics(feedback(L_platform_comp, 1), t_platform_fast, 0.02);
payload.platform_case.peak_fast = closed_loop_peak_to_struct(feedback(L_platform_fast, 1), w_platform);
payload.platform_case.peak_slow = closed_loop_peak_to_struct(feedback(L_platform_slow, 1), w_platform);
payload.platform_case.peak_comp = closed_loop_peak_to_struct(feedback(L_platform_comp, 1), w_platform);
payload.platform_case.bandwidth_fast = estimate_bandwidth(feedback(L_platform_fast, 1), w_platform);
payload.platform_case.bandwidth_slow = estimate_bandwidth(feedback(L_platform_slow, 1), w_platform);
payload.platform_case.bandwidth_comp = estimate_bandwidth(feedback(L_platform_comp, 1), w_platform);

fid = fopen(out_file, "w");
if fid < 0
  error("Cannot open output file: %s", out_file);
endif

fputs(fid, jsonencode(payload));
fclose(fid);
printf("Wrote %s\n", out_file);
