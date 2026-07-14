% 单元 1-3：参数变化、闭环极点与时域响应。
% 使用 Octave control 包生成数值证据，并导出同名 PNG/PDF 成品。

clear all; close all; clc;
pkg load control;

available_toolkits = available_graphics_toolkits();
if any(strcmp(available_toolkits, "qt"))
  graphics_toolkit("qt");
endif

raw_dir = fileparts(mfilename("fullpath"));
processed_dir = fullfile(fileparts(raw_dir), "processed");
data_dir = fullfile(raw_dir, "generated-data");
project_root = fullfile(raw_dir, "..", "..", "..", "..", "..", "..");
arrow_helpers = fullfile(project_root, "course-content", "authoring", "shared", "homework-problems", "2026", "assets", "T3");
addpath(arrow_helpers);

if exist(processed_dir, "dir") ~= 7
  mkdir(processed_dir);
endif
if exist(data_dir, "dir") ~= 7
  mkdir(data_dir);
endif

font_name = "Noto Sans CJK SC";
line_width = 2.0;
axes_font_size = 17;
colors = [
  0.10, 0.32, 0.65;
  0.16, 0.55, 0.38;
  0.78, 0.25, 0.18
];

set(0, "defaultaxesfontname", font_name);
set(0, "defaulttextfontname", font_name);
set(0, "defaultaxesfontweight", "normal");
set(0, "defaulttextfontweight", "normal");
set(0, "defaultlinelinewidth", line_width);
set(0, "defaulttextinterpreter", "tex");
set(0, "defaultaxesTickLabelInterpreter", "tex");

function setup_figure(width, height)
  set(gcf, "visible", "off");
  set(gcf, "color", "w");
  set(gcf, "paperunits", "inches");
  set(gcf, "papersize", [width, height]);
  set(gcf, "paperposition", [0, 0, width, height]);
endfunction

function style_axes(font_name, font_size)
  set(gca, "fontname", font_name, "fontsize", font_size, "linewidth", 1.0);
  grid on;
  box off;
  title("");
endfunction

function save_figure(stem, processed_dir, font_name, font_size)
  text_handles = findall(gcf, "type", "text");
  for tx = text_handles'
    set(tx, "fontname", font_name, "fontweight", "normal", "fontsize", font_size);
  endfor
  axes_handles = findall(gcf, "type", "axes");
  for ax = axes_handles'
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

G0 = tf(1, [1 4 0]);
open_K_values = [1 2 4];
K_values = [1 4 8];
t = (0:0.001:20)';

% 数值审查报告：极点、超调量和 5% 调节时间。
report_path = fullfile(data_dir, "1-3-response-metrics.txt");
fid = fopen(report_path, "w");
fprintf(fid, "G0(s) = 1/[s(s+4)], unit negative feedback\n");
fprintf(fid, "settling-time band = +/-5%% of unit final value\n\n");
for K = K_values
  Phi = feedback(K * G0, 1);
  [overshoot, ts5] = response_metrics(Phi, t);
  poles = pole(Phi);
  fprintf(fid, "K=%g\n", K);
  for index = 1:numel(poles)
    fprintf(fid, "  pole_%d = %.8f %+.8fj\n", index, real(poles(index)), imag(poles(index)));
  endfor
  fprintf(fid, "  overshoot = %.6f%%\n", overshoot);
  fprintf(fid, "  ts_5pct = %.6fs\n\n", ts5);
endfor

best_K = NaN;
best_overshoot = NaN;
best_ts5 = Inf;
t_scan = (0:0.002:5)';
for K = 4:0.02:30
  Phi = feedback(K * G0, 1);
  [overshoot, ts5] = response_metrics(Phi, t_scan);
  if overshoot <= 10 && ts5 < best_ts5
    best_K = K;
    best_overshoot = overshoot;
    best_ts5 = ts5;
  endif
endfor
fprintf(fid, "best 5pct settling time under overshoot <= 10%% (K step 0.02):\n");
fprintf(fid, "  K = %.2f\n", best_K);
fprintf(fid, "  overshoot = %.6f%%\n", best_overshoot);
fprintf(fid, "  ts_5pct = %.6fs\n", best_ts5);

% 习题 5：由候选特征多项式复核极点、周期和标准二阶超调量。
exercise5_poles = roots([1 3 4.7]);
exercise5_sigma = abs(real(exercise5_poles(1)));
exercise5_wd = abs(imag(exercise5_poles(1)));
exercise5_period = 2 * pi / exercise5_wd;
exercise5_overshoot = exp(-pi * exercise5_sigma / exercise5_wd) * 100;
fprintf(fid, "\nexercise 5 candidate s^2 + 3s + 4.7 = 0:\n");
fprintf(fid, "  pole_1 = %.8f %+.8fj\n", real(exercise5_poles(1)), imag(exercise5_poles(1)));
fprintf(fid, "  pole_2 = %.8f %+.8fj\n", real(exercise5_poles(2)), imag(exercise5_poles(2)));
fprintf(fid, "  oscillation_period = %.6fs\n", exercise5_period);
fprintf(fid, "  standard_second_order_overshoot = %.6f%%\n", exercise5_overshoot);
fclose(fid);

% 图 1-3-1：开环响应仅按 K 成比例缩放；当前对象含积分极点，响应不收敛。
figure(1); setup_figure(8.2, 5.0);
t_open = (0:0.01:6)';
handles = [];
hold on;
for index = 1:numel(open_K_values)
  K = open_K_values(index);
  y = step(K * G0, t_open);
  handles(index) = plot(t_open, y, "color", colors(index, :), "linewidth", line_width);
endfor
xlabel("时间 t / s");
ylabel("输出 y(t)");
legend(handles, {"K=1", "K=2", "K=4"}, "location", "northwest");
style_axes(font_name, axes_font_size);
save_figure("1-3-fig-01-open-loop-scaling", processed_dir, font_name, axes_font_size);

% 图 1-3-3：三个典型 K 值的单位阶跃闭环响应。
figure(2); setup_figure(8.2, 5.0);
handles = [];
hold on;
for index = 1:numel(K_values)
  K = K_values(index);
  Phi = feedback(K * G0, 1);
  y = step(Phi, t);
  handles(index) = plot(t, y, "color", colors(index, :), "linewidth", line_width);
endfor
plot([0 20], [1 1], "--", "color", [0.35 0.35 0.35], "linewidth", 1.2);
plot([0 20], [0.95 0.95], ":", "color", [0.55 0.55 0.55], "linewidth", 1.0);
plot([0 20], [1.05 1.05], ":", "color", [0.55 0.55 0.55], "linewidth", 1.0);
xlim([0 15]);
ylim([0 1.12]);
xlabel("时间 t / s");
ylabel("输出 y(t)");
legend(handles, {"K=1", "K=4", "K=8"}, "location", "southeast");
style_axes(font_name, axes_font_size);
save_figure("1-3-fig-03-closed-loop-responses", processed_dir, font_name, axes_font_size);

% 图 1-3-4：rlocus() 自动采样的根轨迹与 K=1,4,8 三组极点。
figure(3); setup_figure(10.2, 5.5);
hold on;
patch([-5.2 0 0 -5.2], [-5 -5 5 5], [0.93 0.96 1.00], "edgecolor", "none");
patch([0 1.2 1.2 0], [-5 -5 5 5], [1.00 0.94 0.94], "edgecolor", "none");
xlim([-5.2 1.2]);
ylim([-5 5]);
pbaspect([1 1 1]);
roots = rlocus(G0);
locus_handle = [];
for branch = 1:rows(roots)
  branch_handles = draw_curve_arrows(gca(), real(roots(branch, :)), imag(roots(branch, :)), ...
    "positions", 0.72, "color", [0.10 0.32 0.65], "linewidth", line_width, ...
    "headlength", 0.04, "headwidth", 0.024);
  if isempty(locus_handle)
    locus_handle = branch_handles(1);
  endif
endfor
open_poles = pole(G0);
open_handle = plot(real(open_poles), imag(open_poles), "x", "color", [0.78 0.16 0.14], ...
  "markersize", 10, "linewidth", 2.0);
marker_handles = [];
marker_styles = {"o", "s", "d"};
for index = 1:numel(K_values)
  K = K_values(index);
  poles = pole(feedback(K * G0, 1));
  marker_handles(index) = plot(real(poles), imag(poles), marker_styles{index}, ...
    "color", colors(index, :), "markerfacecolor", "w", "markersize", 8, "linewidth", 2.0);
endfor
plot([-5.2 1.2], [0 0], "-", "color", [0.35 0.35 0.35], "linewidth", 1.0);
plot([0 0], [-5 5], "-", "color", [0.35 0.35 0.35], "linewidth", 1.2);
xlim([-5.2 1.2]);
ylim([-5 5]);
xlabel("实部 σ");
ylabel("虚部 jω");
legend([locus_handle, open_handle(1), marker_handles], ...
  {"根轨迹（K 增大方向）", "开环极点", "K=1", "K=4", "K=8"}, ...
  "location", "eastoutside");
style_axes(font_name, axes_font_size);
save_figure("1-3-fig-04-root-locus", processed_dir, font_name, axes_font_size);

fprintf("Generated Unit 1-3 figures and metrics report.\n");
