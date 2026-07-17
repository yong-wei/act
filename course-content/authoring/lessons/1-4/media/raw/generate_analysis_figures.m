% 单元 1-4：时域、Bode、Nyquist 与多域联读的数值证据和成图。

clear all; close all; clc;
pkg load control;

available_toolkits = available_graphics_toolkits();
if any(strcmp(available_toolkits, "qt"))
  graphics_toolkit("qt");
endif

raw_dir = fileparts(mfilename("fullpath"));
processed_dir = fullfile(fileparts(raw_dir), "processed");
data_dir = fullfile(raw_dir, "generated-data");

font_name = "Noto Sans CJK SC";
line_width = 2.0;
axes_font_size = 17;
colors = [
  0.10, 0.32, 0.65;
  0.16, 0.55, 0.38;
  0.78, 0.25, 0.18;
  0.46, 0.28, 0.68
];

set(0, "defaultaxesfontname", font_name);
set(0, "defaulttextfontname", font_name);
set(0, "defaultaxesfontweight", "normal");
set(0, "defaulttextfontweight", "normal");
set(0, "defaultlinelinewidth", line_width);
set(0, "defaulttextinterpreter", "tex");
set(0, "defaultaxesTickLabelInterpreter", "tex");
set(0, "defaultfigurecolor", "w");
set(0, "defaultaxescolor", "w");
set(0, "defaultaxesxcolor", [0.12 0.12 0.12]);
set(0, "defaultaxesycolor", [0.12 0.12 0.12]);

function setup_figure(width, height)
  set(gcf, "visible", "off", "color", "w");
  set(gcf, "inverthardcopy", "off");
  set(gcf, "paperunits", "inches", "papersize", [width, height]);
  set(gcf, "paperposition", [0, 0, width, height]);
endfunction

function style_axes(font_name, font_size)
  set(gca, "fontname", font_name, "fontsize", font_size, "linewidth", 1.0, ...
    "color", "w", "xcolor", [0.12 0.12 0.12], "ycolor", [0.12 0.12 0.12]);
  grid on;
  box off;
  title("");
endfunction

function save_figure(stem, processed_dir, font_name, font_size)
  for tx = findall(gcf, "type", "text")'
    set(tx, "fontname", font_name, "fontweight", "normal");
  endfor
  for ax = findall(gcf, "type", "axes")'
    if strcmp(get(ax, "tag"), "legend")
      continue;
    endif
    set(ax, "fontname", font_name, "fontsize", font_size);
    set(get(ax, "title"), "string", "");
  endfor
  print(gcf, fullfile(processed_dir, [stem ".png"]), "-dpng", "-r260");
  print(gcf, fullfile(processed_dir, [stem ".pdf"]), "-dpdf", "-painters");
  close(gcf);
endfunction

function ts = settling_time(t, y, target, tolerance)
  outside = find(abs(y - target) > tolerance * abs(target));
  if isempty(outside)
    ts = 0;
  elseif outside(end) >= numel(t)
    ts = Inf;
  else
    ts = t(outside(end) + 1);
  endif
endfunction

function [overshoot, ts5] = response_metrics(sys, t)
  y = step(sys, t);
  target = dcgain(sys);
  overshoot = max(0, (max(y) - target) / target * 100);
  ts5 = settling_time(t, y, target, 0.05);
endfunction

function [mag, phase] = bode_at(sys, omega)
  [mag_raw, phase_raw] = bode(sys, omega);
  mag = squeeze(mag_raw)(1);
  phase = squeeze(phase_raw)(1);
endfunction

function omega_cross = first_level_crossing(omega, values, target)
  delta = values - target;
  index = find(delta(1:end-1) .* delta(2:end) <= 0, 1, "first");
  if isempty(index)
    omega_cross = NaN;
    return;
  endif
  x1 = log10(omega(index));
  x2 = log10(omega(index + 1));
  y1 = delta(index);
  y2 = delta(index + 1);
  omega_cross = 10 ^ (x1 - y1 * (x2 - x1) / (y2 - y1));
endfunction

G0 = tf(1, [1 4 0]);
K_values = [1 4 8];
L8 = 8 * G0;
T8 = feedback(L8, 1);
t = (0:0.001:20)';
w = logspace(-2, 2, 1200);

% 统一数值证据。
report_path = fullfile(data_dir, "1-4-analysis-metrics.txt");
fid = fopen(report_path, "w");
fprintf(fid, "Unit 1-4 deterministic checks\n\n");
for K = K_values
  T = feedback(K * G0, 1);
  [overshoot, ts5] = response_metrics(T, t);
  poles = pole(T);
  fprintf(fid, "K=%g closed-loop\n", K);
  fprintf(fid, "  poles = %.8f %+.8fj, %.8f %+.8fj\n", ...
    real(poles(1)), imag(poles(1)), real(poles(2)), imag(poles(2)));
  fprintf(fid, "  overshoot = %.6f%%\n", overshoot);
  fprintf(fid, "  ts_5pct = %.6fs\n\n", ts5);
endfor

[mag_T8, phase_T8] = bode(T8, w);
mag_T8 = squeeze(mag_T8);
phase_T8 = squeeze(phase_T8);
bandwidth_T8 = first_level_crossing(w, 20 * log10(mag_T8), -3);
[mag_L8, phase_L8] = bode(L8, w);
mag_L8 = squeeze(mag_L8);
phase_L8 = squeeze(phase_L8);
gain_cross_L8 = first_level_crossing(w, 20 * log10(mag_L8), 0);
[mag_G0_w2, phase_G0_w2] = bode_at(G0, 2);
[mag_T8_w03, phase_T8_w03] = bode_at(T8, 0.3);
[mag_T8_w3, phase_T8_w3] = bode_at(T8, 3);
fprintf(fid, "T8(s)=8/(s^2+4s+8) closed-loop command response\n");
fprintf(fid, "  -3dB bandwidth = %.6f rad/s\n", bandwidth_T8);
fprintf(fid, "  omega=0.3: magnitude=%.8f, phase=%.6f deg\n", mag_T8_w03, phase_T8_w03);
fprintf(fid, "  omega=3: magnitude=%.8f, phase=%.6f deg\n\n", mag_T8_w3, phase_T8_w3);
fprintf(fid, "L8(s)=8/[s(s+4)] loop transfer\n");
fprintf(fid, "  gain crossover = %.6f rad/s\n\n", gain_cross_L8);
fprintf(fid, "G0(j2)\n");
fprintf(fid, "  magnitude=%.8f, magnitude_dB=%.6f dB, phase=%.6f deg\n\n", ...
  mag_G0_w2, 20 * log10(mag_G0_w2), phase_G0_w2);

% 例题 1-4-1 使用的标准二阶闭环模型。
G_example = tf(0.64, [1 0.88 0.64]);
[example_overshoot, example_ts5] = response_metrics(G_example, t);
[mag_ex_w02, phase_ex_w02] = bode_at(G_example, 0.2);
[mag_ex_w4, phase_ex_w4] = bode_at(G_example, 4);
fprintf(fid, "Example 1-4-1: 0.64/(s^2+0.88s+0.64)\n");
fprintf(fid, "  overshoot=%.6f%%, ts_5pct=%.6fs\n", example_overshoot, example_ts5);
fprintf(fid, "  omega=0.2: magnitude=%.8f, phase=%.6f deg\n", mag_ex_w02, phase_ex_w02);
fprintf(fid, "  omega=4: magnitude=%.8f, phase=%.6f deg\n\n", mag_ex_w4, phase_ex_w4);

% 习题 5：标准二阶无零点系统的 3 dB 共振峰反推。
Mr = 10 ^ (3 / 20);
zeta_sq = (1 - sqrt(1 - 1 / (Mr ^ 2))) / 2;
zeta = sqrt(zeta_sq);
Mp = exp(-pi * zeta / sqrt(1 - zeta ^ 2)) * 100;
omega_ratio = sqrt(1 - 2 * zeta ^ 2);
fprintf(fid, "Exercise 5 standard second-order inference\n");
fprintf(fid, "  Mr=%.8f, zeta=%.8f, overshoot=%.6f%%\n", Mr, zeta, Mp);
fprintf(fid, "  omega_r/omega_n=%.8f\n", omega_ratio);
fclose(fid);

% 图 1-4-1：三组 K 的闭环阶跃响应。
figure(1); setup_figure(8.2, 5.0); hold on;
handles = [];
for index = 1:numel(K_values)
  K = K_values(index);
  handles(index) = plot(t, step(feedback(K * G0, 1), t), ...
    "color", colors(index, :), "linewidth", line_width);
endfor
plot([0 15], [1 1], "--", "color", [0.35 0.35 0.35], "linewidth", 1.2);
xlim([0 15]); ylim([0 1.12]);
xlabel("时间 t / s"); ylabel("输出 y(t)");
legend(handles, {"K=1", "K=4", "K=8"}, "location", "southeast");
style_axes(font_name, axes_font_size);
save_figure("1-4-fig-01-step-responses", processed_dir, font_name, axes_font_size);

% 图 1-4-2：闭环指令传递 T8 的 Bode 图和 -3 dB 带宽。
figure(2); setup_figure(8.2, 6.0);
subplot(2, 1, 1);
semilogx(w, 20 * log10(mag_T8), "color", colors(1, :)); hold on;
plot([w(1) w(end)], [-3 -3], ":", "color", [0.45 0.45 0.45]);
plot([bandwidth_T8 bandwidth_T8], [-40 5], "--", "color", colors(3, :));
ylabel("幅值 / dB"); xlim([0.03 50]); ylim([-40 5]); style_axes(font_name, axes_font_size);
subplot(2, 1, 2);
semilogx(w, phase_T8, "color", colors(2, :));
xlabel("角频率 ω / (rad/s)"); ylabel("相位 / (°)");
xlim([0.03 50]); ylim([-190 10]); style_axes(font_name, axes_font_size);
save_figure("1-4-fig-02-closed-loop-bode", processed_dir, font_name, axes_font_size);

% 图 1-4-3：对象 G0 的开环 Bode 图。
[mag_G0, phase_G0] = bode(G0, w);
mag_G0 = squeeze(mag_G0); phase_G0 = squeeze(phase_G0);
figure(3); setup_figure(8.2, 6.0);
subplot(2, 1, 1);
semilogx(w, 20 * log10(mag_G0), "color", colors(1, :));
ylabel("幅值 / dB"); xlim([0.03 50]); style_axes(font_name, axes_font_size);
subplot(2, 1, 2);
semilogx(w, phase_G0, "color", colors(2, :));
xlabel("角频率 ω / (rad/s)"); ylabel("相位 / (°)");
xlim([0.03 50]); ylim([-185 -80]); style_axes(font_name, axes_font_size);
save_figure("1-4-fig-03-open-loop-bode", processed_dir, font_name, axes_font_size);

% 图 1-4-3b：环路 L8=8G0 的 Bode 图和 0 dB 增益穿越频率。
figure(31); setup_figure(8.2, 6.0);
subplot(2, 1, 1); hold on;
semilogx(w, 20 * log10(mag_L8), "color", colors(1, :));
plot([w(1) w(end)], [0 0], ":", "color", [0.35 0.35 0.35], "linewidth", 1.4);
plot([gain_cross_L8 gain_cross_L8], [-55 35], "--", "color", colors(3, :));
text(gain_cross_L8 * 1.08, 23, sprintf("ω_c≈%.3f rad/s", gain_cross_L8), ...
  "color", colors(3, :), "fontsize", axes_font_size, "verticalalignment", "middle");
ylabel("环路幅值 / dB"); xlim([0.03 50]); ylim([-55 35]);
style_axes(font_name, axes_font_size);
subplot(2, 1, 2); hold on;
semilogx(w, phase_L8, "color", colors(2, :));
plot([gain_cross_L8 gain_cross_L8], [-185 -80], "--", "color", colors(3, :));
xlabel("角频率 ω / (rad/s)"); ylabel("环路相位 / (°)");
xlim([0.03 50]); ylim([-185 -80]); style_axes(font_name, axes_font_size);
save_figure("1-4-fig-03b-loop-k8-bode", processed_dir, font_name, axes_font_size);

% 图 1-4-4：G0 的正、负频率响应支；正频率支始终位于第三象限。
w_nyq = logspace(-1, 2, 900);
response_G0 = squeeze(freqresp(G0, w_nyq));
figure(4); setup_figure(8.2, 5.4); hold on;
h_pos = plot(real(response_G0), imag(response_G0), "color", colors(1, :));
h_neg = plot(real(response_G0), -imag(response_G0), "--", "color", colors(2, :));
plot([-0.07 0.01], [0 0], "-", "color", [0.4 0.4 0.4], "linewidth", 1.0);
plot([0 0], [-2.6 2.6], "-", "color", [0.4 0.4 0.4], "linewidth", 1.0);
plot(-1, 0, "x", "color", colors(3, :), "markersize", 10, "linewidth", 2.0);
xlabel("实部"); ylabel("虚部"); xlim([-0.07 0.01]); ylim([-2.6 2.6]);
legend([h_pos h_neg], {"正频率支（ω>0）", "负频率镜像支"}, "location", "eastoutside");
style_axes(font_name, axes_font_size);
save_figure("1-4-fig-04-open-loop-nyquist", processed_dir, font_name, axes_font_size);

% 图 1-4-5：K=8 的四窗口并置。
figure(5); setup_figure(10.2, 7.4);
subplot(2, 2, 1); hold on;
poles_T8 = pole(T8);
plot(real(poles_T8), imag(poles_T8), "x", "color", colors(3, :), "markersize", 11, "linewidth", 2.2);
plot([-4.5 0.8], [0 0], "-", "color", [0.4 0.4 0.4], "linewidth", 1.0);
plot([0 0], [-3.5 3.5], "-", "color", [0.4 0.4 0.4], "linewidth", 1.0);
xlabel("实部 σ"); ylabel("虚部 jω"); xlim([-4.5 0.8]); ylim([-3.5 3.5]); style_axes(font_name, 14);
subplot(2, 2, 2);
plot(t, step(T8, t), "color", colors(1, :)); hold on;
plot([0 6], [1 1], "--", "color", [0.4 0.4 0.4]);
xlabel("时间 t / s"); ylabel("输出 y(t)"); xlim([0 6]); ylim([0 1.12]); style_axes(font_name, 14);
subplot(2, 2, 3);
semilogx(w, 20 * log10(mag_L8), "color", colors(2, :)); hold on;
plot([w(1) w(end)], [0 0], ":", "color", [0.4 0.4 0.4]);
xlabel("角频率 ω / (rad/s)"); ylabel("环路幅值 / dB"); xlim([0.03 50]); style_axes(font_name, 14);
subplot(2, 2, 4); hold on;
response_L8 = 8 * response_G0;
plot(real(response_L8), imag(response_L8), "color", colors(4, :));
plot(real(response_L8), -imag(response_L8), "--", "color", [0.55 0.55 0.55]);
plot(-1, 0, "x", "color", colors(3, :), "markersize", 9, "linewidth", 2.0);
plot([-1.2 0.1], [0 0], "-", "color", [0.4 0.4 0.4], "linewidth", 1.0);
plot([0 0], [-5 5], "-", "color", [0.4 0.4 0.4], "linewidth", 1.0);
xlabel("实部"); ylabel("虚部"); xlim([-1.2 0.1]); ylim([-5 5]); style_axes(font_name, 14);
save_figure("1-4-fig-05-four-views", processed_dir, font_name, 14);

% 图 1-4-6：闭环 T8 的极点、阶跃与闭环频率响应。
figure(6); setup_figure(10.2, 3.8);
subplot(1, 3, 1); hold on;
plot(real(poles_T8), imag(poles_T8), "x", "color", colors(3, :), "markersize", 11, "linewidth", 2.2);
plot([-4.5 0.8], [0 0], "-", "color", [0.4 0.4 0.4], "linewidth", 1.0);
plot([0 0], [-3.5 3.5], "-", "color", [0.4 0.4 0.4], "linewidth", 1.0);
xlabel("实部 σ"); ylabel("虚部 jω"); xlim([-4.5 0.8]); ylim([-3.5 3.5]); style_axes(font_name, 14);
subplot(1, 3, 2);
plot(t, step(T8, t), "color", colors(1, :)); hold on;
plot([0 6], [1 1], "--", "color", [0.4 0.4 0.4]);
xlabel("时间 t / s"); ylabel("阶跃输出"); xlim([0 6]); ylim([0 1.12]); style_axes(font_name, 14);
subplot(1, 3, 3); hold on;
semilogx(w, 20 * log10(mag_T8), "color", colors(2, :));
plot(0.3, 20 * log10(mag_T8_w03), "o", "color", colors(1, :), ...
  "markerfacecolor", "w", "markersize", 8, "linewidth", 2.0);
plot(3, 20 * log10(mag_T8_w3), "s", "color", colors(4, :), ...
  "markerfacecolor", "w", "markersize", 8, "linewidth", 2.0);
plot([w(1) w(end)], [0 0], ":", "color", [0.4 0.4 0.4]);
xlabel("角频率 ω / (rad/s)"); ylabel("闭环幅值 / dB");
xlim([0.03 50]); ylim([-40 5]); style_axes(font_name, 14);
save_figure("1-4-fig-06-three-domain-reading", processed_dir, font_name, 14);

fprintf("Generated Unit 1-4 figures and metrics report.\n");
