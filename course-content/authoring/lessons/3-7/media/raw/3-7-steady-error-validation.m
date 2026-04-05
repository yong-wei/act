1;
pkg load control;
more off;
clear;
clc;

set(0, 'defaultaxesfontname', 'Hiragino Sans GB');
set(0, 'defaulttextfontname', 'Hiragino Sans GB');
set(0, 'defaultaxesfontsize', 11);
set(0, 'defaultlinelinewidth', 1.6);

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

function ess = ramp_error(sys, t_end)
  t = linspace(0, t_end, t_end * 120 + 1);
  r = t;
  y = lsim(sys, r, t);
  ess = r(end) - y(end);
endfunction

s = tf('s');

fprintf('=== 3-7 稳态误差与低频补偿核验 ===\n');

% ---------------------------------------------------------------------------
% 1) 多项式输入稳态误差
% ---------------------------------------------------------------------------
K = 1;
G_poly = K / (s^2 * (0.5 * s + 1));
R_poly = 3 / s + 2 / s^2 + 1 / s^3;
E_poly = minreal((1 / (1 + G_poly)) * R_poly);
e_poly = dcgain(minreal(s * E_poly));
Ka_poly = dcgain(minreal(s^2 * G_poly));

fprintf('\n[1] 多项式输入稳态误差\n');
fprintf('终值定理结果 e_ss = %.6f\n', e_poly);
fprintf('静态误差系数结果 e_ss = %.6f\n', 1 / Ka_poly);

% ---------------------------------------------------------------------------
% 2) 给定与扰动共同作用（中间扰动）
% ---------------------------------------------------------------------------
G1_mix = 5 / (s + 5);
G2_mix = 2 / (s + 2);
L_mix = minreal(G1_mix * G2_mix);
Phi_r = minreal(L_mix / (1 + L_mix));
Phi_d = minreal(G2_mix / (1 + L_mix));
R_mix = 1 / s;
D_mix = 0.2 / s;
C_mix = minreal(Phi_r * R_mix + Phi_d * D_mix);
E_mix = minreal(R_mix - C_mix);
e_mix = dcgain(minreal(s * E_mix));

fprintf('\n[2] 给定与扰动共同作用\n');
fprintf('总稳态误差 e_ss = %.6f\n', e_mix);

% ---------------------------------------------------------------------------
% 3) 纯增益与 PI 的时域设计
% ---------------------------------------------------------------------------
G_mix = 4 / (s * (s + 4));
T_pure = feedback(G_mix, 1);
T_pure_k10 = feedback(10 * G_mix, 1);
T_pi = feedback((s + 0.3) / s * G_mix, 1);
[ts_pure, os_pure, ~] = step_metrics(T_pure, 18);
[ts_pure_k10, os_pure_k10, ~] = step_metrics(T_pure_k10, 18);
[ts_pi, os_pi, ~] = step_metrics(T_pi, 18);

fprintf('\n[3] 纯增益与 PI 的时域设计\n');
fprintf('纯增益 K=1: M_p = %.2f%%, t_s = %.2f s, e_ramp(18) = %.4f\n', os_pure, ts_pure, ramp_error(T_pure, 18));
fprintf('纯增益 K=10: M_p = %.2f%%, t_s = %.2f s, e_ramp(18) = %.4f\n', os_pure_k10, ts_pure_k10, ramp_error(T_pure_k10, 18));
fprintf('PI: M_p = %.2f%%, t_s = %.2f s, e_ramp(18) = %.4f\n', os_pi, ts_pi, ramp_error(T_pi, 18));

% ---------------------------------------------------------------------------
% 4) 滞后校正的时域设计
% ---------------------------------------------------------------------------
T_lag = feedback((s + 0.2) / (s + 0.02) * G_mix, 1);
[ts_lag, os_lag, ~] = step_metrics(T_lag, 18);

fprintf('\n[4] 滞后校正的时域设计\n');
fprintf('滞后: M_p = %.2f%%, t_s = %.2f s, e_ramp(18) = %.4f\n', os_lag, ts_lag, ramp_error(T_lag, 18));

% ---------------------------------------------------------------------------
% 5) 频域设计下的 PI 与 PD
% ---------------------------------------------------------------------------
L_pi = 3 * (s + 0.125) / s * G_mix;
L_pd = 8 * (1 + 0.1 * s) * G_mix;
[~, pm_pi, ~, wcp_pi] = margin(L_pi);
[~, pm_pd, ~, wcp_pd] = margin(L_pd);
T_pi_f = feedback(L_pi, 1);
T_pd_f = feedback(L_pd, 1);
[ts_pi_f, os_pi_f, ~] = step_metrics(T_pi_f, 30);
[ts_pd_f, os_pd_f, ~] = step_metrics(T_pd_f, 8);

fprintf('\n[5] 频域设计下的 PI 与 PD\n');
fprintf('PI: PM = %.2f deg, wc = %.2f rad/s, M_p = %.2f%%, t_s = %.2f s, e_ramp(30) = %.4f\n', ...
  pm_pi, wcp_pi, os_pi_f, ts_pi_f, ramp_error(T_pi_f, 30));
fprintf('PD: PM = %.2f deg, wc = %.2f rad/s, M_p = %.2f%%, t_s = %.2f s, e_ramp(15) = %.4f\n', ...
  pm_pd, wcp_pd, os_pd_f, ts_pd_f, ramp_error(T_pd_f, 15));

fprintf('\n说明：本脚本只负责数值核验；图形输出由 3-7-generate-plots.m 完成。\n');
exit(0);
