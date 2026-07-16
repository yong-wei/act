% 单元 1-5：三域联动的确定性数值验证与出版级成图。

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
axes_font_size = 15;
colors = [
  0.10, 0.32, 0.65;
  0.16, 0.55, 0.38;
  0.78, 0.25, 0.18;
  0.46, 0.28, 0.68;
  0.80, 0.55, 0.12
];

set(0, "defaultaxesfontname", font_name);
set(0, "defaulttextfontname", font_name);
set(0, "defaultaxesfontweight", "normal");
set(0, "defaulttextfontweight", "normal");
set(0, "defaultlinelinewidth", line_width);
set(0, "defaulttextinterpreter", "tex");
set(0, "defaultaxesTickLabelInterpreter", "tex");

function setup_figure(width, height)
  set(gcf, "visible", "off", "color", "w");
  set(gcf, "paperunits", "inches", "papersize", [width, height]);
  set(gcf, "paperposition", [0, 0, width, height]);
endfunction

function style_axes(font_name, font_size)
  set(gca, "fontname", font_name, "fontsize", font_size, "linewidth", 1.0);
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

function [overshoot, ts5, rise_time] = response_metrics(sys)
  poles = pole(sys);
  stable_rate = min(abs(real(poles(real(poles) < 0))));
  horizon = max(40, 15 / stable_rate);
  t = linspace(0, horizon, 200001)';
  y = step(sys, t); y = y(:);
  target = dcgain(sys);
  overshoot = max(0, (max(y) - target) / target * 100);
  ts5 = settling_time(t, y, target, 0.05);
  first10 = find(y >= 0.1 * target, 1, "first");
  first90 = find(y >= 0.9 * target, 1, "first");
  rise_time = t(first90) - t(first10);
endfunction

function draw_three_domain(G0, K, tmax, ylimits, stem, processed_dir, font_name, font_size, colors)
  L = K * G0;
  T = feedback(L, 1);
  poles = pole(T);
  w = logspace(-2, 2, 1400);
  [mag, phase] = bode(L, w);
  mag = squeeze(mag); phase = squeeze(phase);
  [gm, pm, wgm, wpm] = margin(L);
  t = linspace(0, tmax, 5000)';
  y = step(T, t);

  figure(); setup_figure(10.2, 7.4);
  subplot(2, 2, 1); hold on;
  plot(real(poles), imag(poles), "x", "color", colors(3, :), ...
    "markersize", 10, "linewidth", 2.2);
  plot([-7.5 0.6], [0 0], "-", "color", [0.42 0.42 0.42], "linewidth", 1.0);
  plot([0 0], [-3.2 3.2], "-", "color", [0.42 0.42 0.42], "linewidth", 1.0);
  xlabel("实部 σ"); ylabel("虚部 jω");
  xlim([-7.5 0.6]); ylim([-3.2 3.2]); style_axes(font_name, font_size);

  subplot(2, 2, 2); hold on;
  plot(t, y, "color", colors(1, :));
  plot([0 tmax], [1 1], "--", "color", [0.42 0.42 0.42], "linewidth", 1.1);
  xlabel("时间 t / s"); ylabel("阶跃输出 y(t)");
  xlim([0 tmax]); ylim(ylimits); style_axes(font_name, font_size);

  subplot(2, 2, 3); hold on;
  semilogx(w, 20 * log10(mag), "color", colors(2, :));
  plot([w(1) w(end)], [0 0], ":", "color", [0.42 0.42 0.42]);
  if isfinite(wpm)
    plot([wpm wpm], [-60 45], "--", "color", colors(4, :), "linewidth", 1.2);
  endif
  xlabel("角频率 ω / (rad/s)"); ylabel("环路幅值 / dB");
  xlim([0.03 20]); ylim([-60 45]); style_axes(font_name, font_size);

  subplot(2, 2, 4); hold on;
  semilogx(w, phase, "color", colors(5, :));
  plot([w(1) w(end)], [-180 -180], ":", "color", [0.42 0.42 0.42]);
  if isfinite(wpm)
    phase_at_cross = -180 + pm;
    plot(wpm, phase_at_cross, "o", "color", colors(4, :), ...
      "markerfacecolor", "w", "markersize", 7, "linewidth", 1.8);
  endif
  xlabel("角频率 ω / (rad/s)"); ylabel("环路相位 / (°)");
  xlim([0.03 20]); ylim([-280 -80]); style_axes(font_name, font_size);

  save_figure(stem, processed_dir, font_name, font_size);
endfunction

G0 = tf(1, [1 7 6 0]);
K_report = [3 5 6 12 18 20 24 30 36 38 40];

% 统一数值证据。
report_path = fullfile(data_dir, "1-5-analysis-metrics.txt");
fid = fopen(report_path, "w");
fprintf(fid, "Unit 1-5 deterministic checks\n\n");
fprintf(fid, "Plant G0(s)=1/[s(s+1)(s+6)], unity negative feedback\n");
fprintf(fid, "Stable range from Routh: 0 < K < 42\n\n");
for K = K_report
  L = K * G0;
  T = feedback(L, 1);
  poles = pole(T);
  [overshoot, ts5, rise_time] = response_metrics(T);
  [gm, pm, wgm, wpm] = margin(L);
  fprintf(fid, "K=%g\n", K);
  fprintf(fid, "  poles =");
  for p = poles.'
    fprintf(fid, " %.8f %+.8fj", real(p), imag(p));
  endfor
  fprintf(fid, "\n");
  fprintf(fid, "  overshoot = %.6f%%\n", overshoot);
  fprintf(fid, "  rise_time_10_90 = %.6fs\n", rise_time);
  fprintf(fid, "  settling_time_5pct = %.6fs\n", ts5);
  fprintf(fid, "  phase_margin = %.6f deg\n", pm);
  fprintf(fid, "  gain_crossover = %.6f rad/s\n", wpm);
  fprintf(fid, "  gain_margin = %.8f (%.6f dB)\n\n", gm, 20 * log10(gm));
endfor

Kcrit = 42;
Tcrit = feedback(Kcrit * G0, 1);
pcrit = pole(Tcrit);
tcrit = linspace(0, 100, 200001)';
ycrit = step(Tcrit, tcrit); ycrit = ycrit(:);
late = ycrit(tcrit >= 20);
fprintf(fid, "Critical state K=42\n");
fprintf(fid, "  poles =");
for p = pcrit.'
  fprintf(fid, " %.8f %+.8fj", real(p), imag(p));
endfor
fprintf(fid, "\n");
fprintf(fid, "  asymptotic oscillation range after transient = [%.8f, %.8f]\n", min(late), max(late));
fprintf(fid, "  phase_margin = 0 deg, gain_margin = 0 dB\n\n");

Gzero = tf([1 2], [1 7 6 0]);
fprintf(fid, "Exercise 6 added zero: K(s+2)/[s(s+1)(s+6)]\n");
fprintf(fid, "  characteristic polynomial = s^3 + 7s^2 + (6+K)s + 2K\n");
fprintf(fid, "  Routh first-column condition: 7(6+K)-2K = 42+5K > 0 for K>0\n");
fprintf(fid, "  no finite positive critical gain; closed loop remains stable for every K>0\n\n");

Galt = tf(1, [1 7 10 0]);
Kcrit_alt = 70;
pcrit_alt = pole(feedback(Kcrit_alt * Galt, 1));
fprintf(fid, "Exercise 7 suggested plant G1(s)=1/[s(s+2)(s+5)]\n");
fprintf(fid, "  critical gain = 70\n");
fprintf(fid, "  critical poles =");
for p = pcrit_alt.'
  fprintf(fid, " %.8f %+.8fj", real(p), imag(p));
endfor
fprintf(fid, "\n");
fclose(fid);

% 图 1-5-1、1-5-2、1-5-4：固定增益下的三域证据。
draw_three_domain(G0, 3, 18, [0 1.15], "1-5-fig-01-three-domain-k3", ...
  processed_dir, font_name, axes_font_size, colors);
draw_three_domain(G0, 12, 18, [0 1.60], "1-5-fig-02-three-domain-k12", ...
  processed_dir, font_name, axes_font_size, colors);
draw_three_domain(G0, 42, 15, [0 2.05], "1-5-fig-04-critical-k42", ...
  processed_dir, font_name, axes_font_size, colors);

% 图 1-5-3：K=24 与 K=36 的阶跃响应对比。
figure(); setup_figure(8.2, 5.0); hold on;
t_compare = linspace(0, 80, 12000)';
h24 = plot(t_compare, step(feedback(24 * G0, 1), t_compare), "color", colors(1, :));
h36 = plot(t_compare, step(feedback(36 * G0, 1), t_compare), "color", colors(3, :));
plot([0 80], [1 1], "--", "color", [0.42 0.42 0.42], "linewidth", 1.1);
xlabel("时间 t / s"); ylabel("阶跃输出 y(t)");
xlim([0 80]); ylim([0 2.0]);
legend([h24 h36], {"K=24", "K=36"}, "location", "northeast");
style_axes(font_name, 17);
save_figure("1-5-fig-03-step-k24-k36", processed_dir, font_name, 17);

% 图 1-5-5：根轨迹、阶跃族与相位裕度随 K 的汇总。
figure(); setup_figure(10.4, 3.9);
subplot(1, 3, 1); hold on;
[root_data, break_gain] = rlocus(G0);
for branch = 1:rows(root_data)
  plot(real(root_data(branch, :)), imag(root_data(branch, :)), ...
    "color", colors(1, :), "linewidth", 1.8);
endfor
for index = 1:5
  K = [3 12 24 36 42](index);
  p = pole(feedback(K * G0, 1));
  plot(real(p), imag(p), "o", "color", colors(index, :), ...
    "markerfacecolor", "w", "markersize", 6, "linewidth", 1.5);
endfor
plot([-7.5 0.8], [0 0], "-", "color", [0.42 0.42 0.42], "linewidth", 1.0);
plot([0 0], [-4.5 4.5], "-", "color", [0.42 0.42 0.42], "linewidth", 1.0);
xlabel("实部 σ"); ylabel("虚部 jω");
xlim([-7.5 0.8]); ylim([-4.5 4.5]); style_axes(font_name, 13);

subplot(1, 3, 2); hold on;
t_family = linspace(0, 60, 9000)';
family_handles = [];
family_K = [3 12 24 36];
for index = 1:numel(family_K)
  family_handles(index) = plot(t_family, ...
    step(feedback(family_K(index) * G0, 1), t_family), ...
    "color", colors(index, :), "linewidth", 1.7);
endfor
plot([0 60], [1 1], "--", "color", [0.42 0.42 0.42], "linewidth", 1.0);
xlabel("时间 t / s"); ylabel("阶跃输出");
xlim([0 60]); ylim([0 2.0]);
legend(family_handles, {"K=3", "K=12", "K=24", "K=36"}, ...
  "location", "northeast");
style_axes(font_name, 13);

subplot(1, 3, 3); hold on;
K_grid = 1:42;
pm_grid = zeros(size(K_grid));
for index = 1:numel(K_grid)
  [gm_value, pm_grid(index)] = margin(K_grid(index) * G0);
endfor
plot(K_grid, pm_grid, "color", colors(2, :));
plot([1 42], [0 0], ":", "color", [0.42 0.42 0.42]);
plot(42, 0, "x", "color", colors(3, :), "markersize", 9, "linewidth", 2.0);
xlabel("增益 K"); ylabel("相位裕度 / (°)");
xlim([1 42]); ylim([-2 80]); style_axes(font_name, 13);

save_figure("1-5-fig-05-sweep-summary", processed_dir, font_name, 13);

fprintf("Generated Unit 1-5 figures and metrics report.\n");
