1;
pkg load control;
more off;
clear;
clc;

set(0, 'defaultfigurevisible', 'off');
set(0, 'defaultaxesfontname', 'Hiragino Sans GB');
set(0, 'defaulttextfontname', 'Hiragino Sans GB');
set(0, 'defaultaxesfontsize', 13);
set(0, 'defaultlinelinewidth', 2.4);

global processed_dir;
raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
if ~exist(processed_dir, 'dir')
  mkdir(processed_dir);
endif

function save_png(filename)
  global processed_dir;
  print(fullfile(processed_dir, filename), '-dpng', '-S1500,1120');
endfunction

function style_axes()
  grid on;
  set(gca, 'linewidth', 1.2, 'fontsize', 12, 'box', 'on');
endfunction

function note_panel(title_text, lines, panel_color)
  axis([0 1 0 1]);
  axis off;
  hold on;
  patch([0.04 0.96 0.96 0.04], [0.08 0.08 0.94 0.94], panel_color, ...
    'edgecolor', [0.82 0.78 0.72], 'linewidth', 1.4);
  text(0.08, 0.88, title_text, 'fontsize', 13, 'fontweight', 'bold', 'interpreter', 'none');
  y = 0.74;
  for i = 1:numel(lines)
    text(0.09, y, lines{i}, 'fontsize', 11, 'interpreter', 'none');
    y = y - 0.13;
  endfor
endfunction

function [settling_time, overshoot, final_value] = step_metrics(sys, t_end)
  t = linspace(0, t_end, t_end * 120 + 1);
  [y, t] = step(sys, t);
  final_value = y(end);
  overshoot = max((max(y) - final_value) / final_value * 100, 0);
  band = 0.02 * abs(final_value);
  idx = find(abs(y - final_value) > band);
  if isempty(idx)
    settling_time = 0;
  elseif idx(end) == numel(t)
    settling_time = NaN;
  else
    settling_time = t(idx(end) + 1);
  endif
endfunction

function [t, e] = ramp_error_response(sys, t_end)
  t = linspace(0, t_end, t_end * 120 + 1)';
  r = t;
  y = lsim(sys, r, t);
  e = r - y;
endfunction

function plot_feasible_region(zeta_min, sigma_min, x_max, y_max)
  hold on;
  patch([-x_max, -sigma_min, -sigma_min, -x_max], [y_max, y_max, -y_max, -y_max], ...
    [0.92 0.96 1.00], 'edgecolor', 'none');
  sigma = linspace(0, x_max, 400);
  theta = acos(zeta_min);
  omega = sigma .* tan(theta);
  plot(-sigma_min * [1 1], [-y_max y_max], '--', 'color', [0.45 0.45 0.45], 'linewidth', 1.6);
  plot(-sigma, omega, ':', 'color', [0.45 0.45 0.45], 'linewidth', 1.6);
  plot(-sigma, -omega, ':', 'color', [0.45 0.45 0.45], 'linewidth', 1.6);
  text(-2.6, 2.35, sprintf('\\zeta = %.3f', zeta_min), 'fontsize', 11, 'color', [0.35 0.35 0.35]);
  text(-2.05, 2.8, sprintf('Re = -%.3f', sigma_min), 'fontsize', 11, 'color', [0.35 0.35 0.35]);
endfunction

function plot_rlocus_family(sys, increment, min_k, max_k, color_rgb)
  [rldata, ~] = rlocus(sys, increment, min_k, max_k);
  for i = 1:rows(rldata)
    plot(real(rldata(i, :)), imag(rldata(i, :)), 'color', color_rgb, 'linewidth', 2.0);
    hold on;
  endfor
endfunction

function mag = magnitude_db(sys, w)
  [mag_raw, ~] = bode(sys, w);
  mag = 20 * log10(squeeze(mag_raw));
endfunction

s = tf('s');
G = 4 / (s * (s + 4));
t_step = linspace(0, 18, 18 * 120 + 1);
t_step_col = t_step(:);

pure_color = [0.12 0.31 0.56];
pi_color = [0.82 0.34 0.08];
lag_color = [0.07 0.48 0.40];
pd_color = [0.44 0.28 0.70];
gray_color = [0.55 0.60 0.62];

% ---------------------------------------------------------------------------
% 图：PI / 滞后 / 超前的低频补偿差异
% ---------------------------------------------------------------------------
w_shape = logspace(-2, 2, 900);
G_pi_shape = (s + 0.5) / s;
G_lag_shape = (5 * s + 1) / (50 * s + 1);
G_lead_shape = (5 * s + 1) / (s + 1);
mag_pi_shape = magnitude_db(G_pi_shape, w_shape);
mag_lag_shape = magnitude_db(G_lag_shape, w_shape);
mag_lead_shape = magnitude_db(G_lead_shape, w_shape);

fig = figure('position', [60, 60, 1500, 1120]);
subplot(2, 2, 1);
semilogx(w_shape, mag_pi_shape, 'color', pi_color, 'linewidth', 2.4);
hold on;
plot([0.5 0.5], [-45 15], '--', 'color', gray_color, 'linewidth', 1.6);
style_axes();
axis([1e-2 1e2 -45 15]);
ylabel('Mag (dB)');
title('PI', 'fontsize', 13);
text(0.018, -8, '\omega_z = 0.5', 'fontsize', 12, 'color', gray_color);

subplot(2, 2, 2);
semilogx(w_shape, mag_lag_shape, 'color', lag_color, 'linewidth', 2.4);
hold on;
plot([0.02 0.02], [-25 5], '--', 'color', gray_color, 'linewidth', 1.6);
plot([0.2 0.2], [-25 5], '--', 'color', gray_color, 'linewidth', 1.6);
style_axes();
axis([1e-2 1e2 -25 5]);
ylabel('Mag (dB)');
title('Lag', 'fontsize', 13);
text(0.013, -3, '\omega_p = 0.02', 'fontsize', 12, 'color', gray_color);
text(0.11, -17, '\omega_z = 0.2', 'fontsize', 12, 'color', gray_color);

subplot(2, 2, 3);
semilogx(w_shape, mag_lead_shape, 'color', pd_color, 'linewidth', 2.4);
hold on;
plot([0.2 0.2], [-15 20], '--', 'color', gray_color, 'linewidth', 1.6);
plot([1 1], [-15 20], '--', 'color', gray_color, 'linewidth', 1.6);
style_axes();
axis([1e-2 1e2 -15 20]);
xlabel('\omega (rad/s)');
ylabel('Mag (dB)');
title('Lead', 'fontsize', 13);
text(0.11, 3.5, '\omega_z = 0.2', 'fontsize', 12, 'color', gray_color);
text(0.72, 11.5, '\omega_p = 1', 'fontsize', 12, 'color', gray_color);

subplot(2, 2, 4);
note_panel(
  'Summary',
  {
    'PI: add an integrator.'
    'Lag: more low-freq gain.'
    'Lead: more phase near wc.'
    'Break order differs.'
  },
  [0.96 0.97 0.99]
);

save_png('3-7-low-frequency-compensators.png');
printf('已生成 %s\n', fullfile(processed_dir, '3-7-low-frequency-compensators.png'));
close(fig);

% ---------------------------------------------------------------------------
% 图：纯增益局限与 PI 时域设计
% ---------------------------------------------------------------------------
L_pure = G;
L_pure_k10 = 10 * G;
L_pi_base = (s + 0.3) / s * G;
L_pi = 1.0 * L_pi_base;
T_pure = feedback(L_pure, 1);
T_pure_k10 = feedback(L_pure_k10, 1);
T_pi = feedback(L_pi, 1);
[ts_pure_k10, os_pure_k10, ~] = step_metrics(T_pure_k10, 18);
[ts_pi, os_pi, ~] = step_metrics(T_pi, 18);
[t_ramp, e_pure_ramp] = ramp_error_response(T_pure, 18);
[~, e_pure_k10_ramp] = ramp_error_response(T_pure_k10, 18);
[~, e_pi_ramp] = ramp_error_response(T_pi, 18);
[y_pure, ~] = step(T_pure, t_step);
[y_pure_k10, ~] = step(T_pure_k10, t_step);
[y_pi, ~] = step(T_pi, t_step);

fig = figure('position', [60, 60, 1500, 1120]);
subplot(2, 2, 1);
plot_rlocus_family(L_pure, 0.05, 0, 20, pure_color);
plot_rlocus_family(L_pi_base, 0.01, 0, 5, pi_color);
plot_feasible_region(0.456, 0.333, 6, 6);
roots_pure_k10 = pole(T_pure_k10);
roots_pi = pole(T_pi);
plot(real(roots_pure_k10), imag(roots_pure_k10), 'x', 'markersize', 10, 'linewidth', 2.0, 'color', pure_color);
plot(real(roots_pi), imag(roots_pi), 'o', 'markersize', 8, 'markerfacecolor', pi_color, 'color', pi_color);
style_axes();
axis([-4.6 0.6 -3.4 3.4]);
axis square;
ylabel('Im');
title('Root locus', 'fontsize', 13);

subplot(2, 2, 2);
plot(t_step_col, y_pure(:), 'color', pure_color, 'linewidth', 2.4);
hold on;
plot(t_step_col, y_pure_k10(:), '--', 'color', pure_color, 'linewidth', 2.4);
plot(t_step_col, y_pi(:), 'color', pi_color, 'linewidth', 2.4);
plot([0 18], [1 1], ':', 'color', gray_color, 'linewidth', 1.6);
style_axes();
ylabel('y(t)');
title('Step', 'fontsize', 13);

subplot(2, 2, 3);
plot(t_ramp, e_pure_ramp, 'color', pure_color, 'linewidth', 2.4);
hold on;
plot(t_ramp, e_pure_k10_ramp, '--', 'color', pure_color, 'linewidth', 2.4);
plot(t_ramp, e_pi_ramp, 'color', pi_color, 'linewidth', 2.4);
plot([0 18], [0 0], ':', 'color', gray_color, 'linewidth', 1.6);
style_axes();
xlabel('t (s)');
ylabel('e(t)');
title('Ramp error', 'fontsize', 13);

subplot(2, 2, 4);
note_panel(
  'PI design',
  {
    'Need zero ramp error.'
    'Pure gain only reduces Kv.'
    sprintf('Gain K=10: Mp=%.1f.', os_pure_k10)
    sprintf('PI: Mp=%.1f, ts=%.1f s.', os_pi, ts_pi)
    'Type I -> Type II.'
  },
  [0.97 0.95 0.91]
);

save_png('3-7-pi-time-domain-design.png');
printf('已生成 %s\n', fullfile(processed_dir, '3-7-pi-time-domain-design.png'));
close(fig);

% ---------------------------------------------------------------------------
% 图：滞后校正的根轨迹与时域验证
% ---------------------------------------------------------------------------
L_lag_base = (s + 0.2) / (s + 0.02) * G;
L_lag = L_lag_base;
T_lag = feedback(L_lag, 1);
[ts_lag, os_lag, ~] = step_metrics(T_lag, 18);
[~, e_lag_ramp] = ramp_error_response(T_lag, 18);
[y_lag, ~] = step(T_lag, t_step);

fig = figure('position', [60, 60, 1500, 1120]);
subplot(2, 2, 1);
plot_rlocus_family(L_pure, 0.05, 0, 20, pure_color);
plot_rlocus_family(L_lag_base, 0.05, 0, 20, lag_color);
plot_feasible_region(0.456, 0.333, 6, 6);
roots_lag = pole(T_lag);
plot(real(roots_pure_k10), imag(roots_pure_k10), 'x', 'markersize', 10, 'linewidth', 2.0, 'color', pure_color);
plot(real(roots_lag), imag(roots_lag), 'o', 'markersize', 8, 'markerfacecolor', lag_color, 'color', lag_color);
style_axes();
axis([-4.6 0.6 -3.4 3.4]);
axis square;
ylabel('Im');
title('Root locus', 'fontsize', 13);

subplot(2, 2, 2);
plot(t_step_col, y_pure(:), 'color', pure_color, 'linewidth', 2.4);
hold on;
plot(t_step_col, y_pure_k10(:), '--', 'color', pure_color, 'linewidth', 2.4);
plot(t_step_col, y_lag(:), 'color', lag_color, 'linewidth', 2.4);
plot([0 18], [1 1], ':', 'color', gray_color, 'linewidth', 1.6);
style_axes();
ylabel('y(t)');
title('Step', 'fontsize', 13);

subplot(2, 2, 3);
plot(t_ramp, e_pure_ramp, 'color', pure_color, 'linewidth', 2.4);
hold on;
plot(t_ramp, e_pure_k10_ramp, '--', 'color', pure_color, 'linewidth', 2.4);
plot(t_ramp, e_lag_ramp, 'color', lag_color, 'linewidth', 2.4);
plot([0 18], [0 0], ':', 'color', gray_color, 'linewidth', 1.6);
style_axes();
xlabel('t (s)');
ylabel('e(t)');
title('Ramp error', 'fontsize', 13);

subplot(2, 2, 4);
note_panel(
  'Lag design',
  {
    'Keep the same pole region.'
    'Gain K=10 weakens damping.'
    'Lag lifts low-frequency gain.'
    sprintf('Lag: Mp=%.1f, ts=%.1f s.', os_lag, ts_lag)
    'Ramp error drops, not zero.'
  },
  [0.92 0.97 0.95]
);

save_png('3-7-lag-time-domain-design.png');
printf('已生成 %s\n', fullfile(processed_dir, '3-7-lag-time-domain-design.png'));
close(fig);

% ---------------------------------------------------------------------------
% 图：PI 频域设计
% ---------------------------------------------------------------------------
L_gain4 = 4 * G;
L_gain10 = 10 * G;
L_pi_f = 3 * (s + 0.125) / s * G;
T_gain4 = feedback(L_gain4, 1);
T_gain10 = feedback(L_gain10, 1);
T_pi_f = feedback(L_pi_f, 1);
[ts_pi_f, os_pi_f, ~] = step_metrics(T_pi_f, 18);
w = logspace(-2, 2, 800);
[mag_g4, phase_g4] = bode(L_gain4, w);
[mag_g10, phase_g10] = bode(L_gain10, w);
[mag_pi, phase_pi] = bode(L_pi_f, w);
mag_g4 = 20 * log10(squeeze(mag_g4));
mag_g10 = 20 * log10(squeeze(mag_g10));
mag_pi = 20 * log10(squeeze(mag_pi));
phase_g4 = squeeze(phase_g4);
phase_g10 = squeeze(phase_g10);
phase_pi = squeeze(phase_pi);
[~, pm_pi, ~, wcp_pi] = margin(L_pi_f);
[y_g4, ~] = step(T_gain4, t_step);
[y_g10, ~] = step(T_gain10, t_step);
[y_pi_f, ~] = step(T_pi_f, t_step);

fig = figure('position', [60, 60, 1500, 1120]);
subplot(2, 2, 1);
semilogx(w, mag_g4, 'color', gray_color, 'linewidth', 2.4);
hold on;
semilogx(w, mag_g10, '--', 'color', pure_color, 'linewidth', 2.4);
semilogx(w, mag_pi, 'color', pi_color, 'linewidth', 2.4);
plot([0.01 100], [0 0], ':', 'color', [0.45 0.45 0.45], 'linewidth', 1.6);
plot([2.5 2.5], [-80 65], '--', 'color', [0.45 0.45 0.45], 'linewidth', 1.6);
style_axes();
axis([1e-2 1e2 -65 65]);
ylabel('Mag (dB)');
title('Magnitude', 'fontsize', 13);

subplot(2, 2, 2);
semilogx(w, phase_g4, 'color', gray_color, 'linewidth', 2.4);
hold on;
semilogx(w, phase_g10, '--', 'color', pure_color, 'linewidth', 2.4);
semilogx(w, phase_pi, 'color', pi_color, 'linewidth', 2.4);
plot([0.01 100], [-180 -180], ':', 'color', [0.45 0.45 0.45], 'linewidth', 1.6);
plot([2.5 2.5], [-220 -80], '--', 'color', [0.45 0.45 0.45], 'linewidth', 1.6);
style_axes();
axis([1e-2 1e2 -220 -80]);
ylabel('Phase (deg)');
title('Phase', 'fontsize', 13);

subplot(2, 2, 3);
plot(t_step_col, y_g4(:), 'color', gray_color, 'linewidth', 2.4);
hold on;
plot(t_step_col, y_g10(:), '--', 'color', pure_color, 'linewidth', 2.4);
plot(t_step_col, y_pi_f(:), 'color', pi_color, 'linewidth', 2.4);
plot([0 18], [1 1], ':', 'color', [0.45 0.45 0.45], 'linewidth', 1.6);
style_axes();
xlabel('t (s)');
ylabel('y(t)');
title('Step', 'fontsize', 13);

subplot(2, 2, 4);
note_panel(
  'PI design',
  {
    '1. Set wc near 2.5 rad/s.'
    '2. Put the PI zero below wc.'
    '3. Solve K from magnitude.'
    sprintf('PM=%.1f deg, wc=%.2f rad/s.', pm_pi, wcp_pi)
    sprintf('Mp=%.1f, ts=%.1f s.', os_pi_f, ts_pi_f)
  },
  [0.97 0.94 0.90]
);

save_png('3-7-pi-frequency-design.png');
printf('已生成 %s\n', fullfile(processed_dir, '3-7-pi-frequency-design.png'));
close(fig);

% ---------------------------------------------------------------------------
% 图：PI 与 PD 的时域响应对比
% ---------------------------------------------------------------------------
T_pd_f = feedback(8 * (1 + 0.1 * s) * G, 1);
t_pd = linspace(0, 12, 12 * 120 + 1);
[y_pi_step, ~] = step(T_pi_f, t_pd);
[y_pd_step, ~] = step(T_pd_f, t_pd);
[t_err, e_pi_f_ramp] = ramp_error_response(T_pi_f, 12);
[~, e_pd_ramp] = ramp_error_response(T_pd_f, 12);
[ts_pd_f, os_pd_f, ~] = step_metrics(T_pd_f, 12);
[~, pm_pd, ~, wcp_pd] = margin(8 * (1 + 0.1 * s) * G);

fig = figure('position', [60, 60, 1500, 1120]);
subplot(2, 2, 1);
plot(t_pd(:), y_pi_step(:), 'color', pi_color, 'linewidth', 2.4);
hold on;
plot(t_pd(:), y_pd_step(:), 'color', pd_color, 'linewidth', 2.4);
plot([0 12], [1 1], ':', 'color', [0.45 0.45 0.45], 'linewidth', 1.6);
style_axes();
xlabel('t (s)');
ylabel('y(t)');
title('Step', 'fontsize', 13);

subplot(2, 2, 2);
plot(t_err, e_pi_f_ramp, 'color', pi_color, 'linewidth', 2.4);
hold on;
plot(t_err, e_pd_ramp, 'color', pd_color, 'linewidth', 2.4);
plot([0 12], [0 0], ':', 'color', [0.45 0.45 0.45], 'linewidth', 1.6);
style_axes();
xlabel('t (s)');
ylabel('e(t)');
title('Ramp error', 'fontsize', 13);

subplot(2, 2, 3);
note_panel(
  'PI metrics',
  {
    sprintf('PM=%.1f deg', pm_pi)
    sprintf('wc=%.2f rad/s', wcp_pi)
    sprintf('Mp=%.1f, ts=%.1f s', os_pi_f, ts_pi_f)
    'Ramp error -> 0.'
  },
  [0.97 0.94 0.90]
);

subplot(2, 2, 4);
note_panel(
  'PD metrics',
  {
    sprintf('PM=%.1f deg', pm_pd)
    sprintf('wc=%.2f rad/s', wcp_pd)
    sprintf('Mp=%.1f, ts=%.1f s', os_pd_f, ts_pd_f)
    'Ramp error finite.'
  },
  [0.95 0.94 0.98]
);

save_png('3-7-pi-pd-comparison.png');
printf('已生成 %s\n', fullfile(processed_dir, '3-7-pi-pd-comparison.png'));
close(fig);
