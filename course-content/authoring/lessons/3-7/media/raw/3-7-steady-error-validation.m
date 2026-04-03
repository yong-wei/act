pkg load control;
more off;
clear;
clc;

fprintf('=== 3-7 稳态误差与低频补偿核验 ===\n');

s = tf('s');
T = 2;
K = 5;
G = K/(s*(T*s + 1));
Gd = 1/(s*(T*s + 1));

fprintf('\n[1] 双通道稳态误差核验\n');
Er_tf = minreal(1/(1 + G));
Ed_tf = minreal(-Gd/(1 + G));
err_ref_ss = dcgain(Er_tf);
err_dist_ss = dcgain(Ed_tf);
fprintf('给定单位阶跃稳态误差 e_ss^(r) = %.6f\n', err_ref_ss);
fprintf('扰动单位阶跃稳态误差 e_ss^(d) = %.6f\n', err_dist_ss);
fprintf('理论值分别应接近 0 与 -1/K = %.6f\n', -1 / K);

fprintf('\n[2] 型别与静差对照\n');
G0 = 4/(3*s + 1);
G1 = 4/(s*(3*s + 1));
G2 = 4/(s^2*(3*s + 1));

Kp0 = dcgain(G0);
Kv1 = dcgain(minreal(s * G1));
Ka2 = dcgain(minreal(s^2 * G2));

fprintf('0型系统阶跃稳态误差 = %.6f\n', 1/(1 + Kp0));
fprintf('I型系统斜坡稳态误差 = %.6f\n', 1/Kv1);
fprintf('II型系统抛物线稳态误差 = %.6f\n', 1/Ka2);

fprintf('\n[3] 增益增大 vs 积分补偿\n');
G_base = 2/(3*s + 1);
G_gain = 8/(3*s + 1);
G_int = 2*(1 + 1/(2*s))/(3*s + 1);
Kp_base = dcgain(G_base);
Kp_gain = dcgain(G_gain);
base_step_err = 1/(1 + Kp_base);
gain_step_err = 1/(1 + Kp_gain);
int_step_err = dcgain(minreal(s * (1/(1 + G_int) * (1/s))));
fprintf('原0型系统阶跃稳态误差 = %.6f\n', base_step_err);
fprintf('调大增益后阶跃稳态误差 = %.6f\n', gain_step_err);
fprintf('加入PI后阶跃稳态误差 = %.6f\n', int_step_err);

fprintf('\n[4] PI 与滞后补偿趋势比较\n');
Gp = 1/((2*s + 1)*(s + 1));
Gc_pi = 2*(1 + 1/(3*s));
Gc_lag = 4*(4*s + 1)/(16*s + 1);
L_pi = minreal(Gc_pi * Gp);
L_lag = minreal(Gc_lag * Gp);

Kp_orig = dcgain(Gp);
Kp_lag = dcgain(Gc_lag * Gp);
pi_ramp_err = dcgain(minreal(s * (1/(1 + L_pi) * (1/s^2))));
orig_step_err = 1/(1 + Kp_orig);
lag_step_err = 1/(1 + Kp_lag);

fprintf('原系统阶跃稳态误差 = %.6f\n', orig_step_err);
fprintf('滞后补偿并重整增益后阶跃稳态误差 = %.6f\n', lag_step_err);
fprintf('PI补偿后斜坡稳态误差 = %.6f\n', pi_ramp_err);

fprintf('\n[5] 阶跃响应抽样（只做趋势验证）\n');
t = 0:0.05:30;
T_orig = feedback(Gp, 1);
T_pi = feedback(L_pi, 1);
T_lag = feedback(L_lag, 1);
y_orig = step(T_orig, t);
y_pi = step(T_pi, t);
y_lag = step(T_lag, t);

fprintf('原系统末值近似 = %.6f\n', y_orig(end));
fprintf('PI补偿后末值近似 = %.6f\n', y_pi(end));
fprintf('滞后补偿后末值近似 = %.6f\n', y_lag(end));

fprintf('\n核验完成。\n');
