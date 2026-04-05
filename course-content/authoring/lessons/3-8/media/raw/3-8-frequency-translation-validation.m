function bw = estimate_bandwidth(w, mag)
  threshold = mag(1) / sqrt(2);
  idx = find(mag <= threshold, 1, 'first');
  if isempty(idx)
    bw = NaN;
  else
    bw = w(idx);
  endif
endfunction

function metrics = step_metrics(t, y, tol)
  final_value = y(end);
  if abs(final_value) < 1e-12
    overshoot = 0;
  else
    overshoot = max(0, (max(y) - final_value) / abs(final_value) * 100);
  endif

  [~, peak_idx] = max(y);
  out_of_band = find(abs(y - final_value) > tol * max(abs(final_value), 1e-12));
  if isempty(out_of_band)
    settling_time = t(1);
  else
    last_out = out_of_band(end);
    if last_out < length(t)
      settling_time = t(last_out + 1);
    else
      settling_time = t(end);
    endif
  endif

  metrics = struct( ...
    'overshoot', overshoot, ...
    'peak_time', t(peak_idx), ...
    'settling_time', settling_time ...
  );
endfunction

function print_frequency(label, value, unit)
  if isfinite(value)
    printf('%s: %.4f %s\n', label, value, unit);
  else
    printf('%s: 无穷大 / 不存在\n', label);
  endif
endfunction

function analyze_case(L, t_grid, w_grid_open, w_grid_closed, label)
  T = feedback(L, 1);
  [gm, pm, wg, wc] = margin(L);
  [mag_cl, ~] = bode(T, w_grid_closed);
  mag_cl = squeeze(mag_cl);
  [mr, idx] = max(mag_cl);
  wr = w_grid_closed(idx);
  bw = estimate_bandwidth(w_grid_closed, mag_cl);
  [y, t] = step(T, t_grid);
  metrics = step_metrics(t, y, 0.02);

  printf('\n[%s]\n', label);
  if isfinite(gm)
    printf('增益裕度: %.4f dB\n', 20 * log10(gm));
  else
    printf('增益裕度: 无穷大 / 不存在\n');
  endif
  printf('相角裕度: %.4f deg\n', pm);
  print_frequency('相位穿越频率', wg, 'rad/s');
  print_frequency('截止频率', wc, 'rad/s');
  printf('谐振峰值 Mr: %.4f (%.4f dB)\n', mr, 20 * log10(mr));
  printf('谐振频率 wr: %.4f rad/s\n', wr);
  printf('闭环带宽: %.4f rad/s\n', bw);
  printf('超调量: %.2f %%\n', metrics.overshoot);
  printf('峰值时间: %.4f s\n', metrics.peak_time);
  printf('调节时间: %.4f s\n', metrics.settling_time);
endfunction

pkg load control;

printf('=== 3-8 频域判别与跨域综合语言：数值验证 ===\n');

s = tf('s');

% 航向控制：基线与超前校正
L_heading_base = 0.01715 * 2.25 / (s * (s + 0.1) * (s + 2.14375));
C_heading = (1 + s / 0.05) / (1 + s / 0.3);
L_heading_comp = C_heading * L_heading_base;

analyze_case(L_heading_base, 0:0.1:250, logspace(-3, 1, 6000), logspace(-3, 1, 6000), '航向控制：基线');
analyze_case(L_heading_comp, 0:0.1:250, logspace(-3, 1, 6000), logspace(-3, 1, 6000), '航向控制：超前校正后');

% 稳定平台：激进基线、仅降增益、超前校正
L_platform_base = 2960 * (s / 15 + 1) / ...
  (s * (s / 3 + 1) * (((1.7 * s + 1) * (0.005 * s + 1) * (0.001 * s + 1)) + 100));
C_platform = (1 + s / 3) / (1 + s / 12);

analyze_case(5.0 * L_platform_base, 0:0.001:2.5, logspace(-1, 3, 8000), logspace(-1, 3, 8000), '稳定平台：激进基线 K=5');
analyze_case(0.2 * L_platform_base, 0:0.002:8.0, logspace(-1, 3, 8000), logspace(-1, 3, 8000), '稳定平台：仅降增益 K=0.2');
analyze_case(C_platform * L_platform_base, 0:0.001:2.5, logspace(-1, 3, 8000), logspace(-1, 3, 8000), '稳定平台：超前校正 K=1');
