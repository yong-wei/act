1;
pkg load control;

set(0, 'defaultaxesfontname', 'Microsoft YaHei');
set(0, 'defaulttextfontname', 'Microsoft YaHei');
fig = figure('visible', 'off', 'color', [0.9725, 0.9804, 0.9882], 'position', [80, 80, 1180, 780]);
set(fig, 'paperunits', 'points');
set(fig, 'papersize', [1180, 780]);
set(fig, 'paperposition', [0, 0, 1180, 780]);
t = 0:0.01:10;
t_unstable = 0:0.01:6;
s = tf('s');
sys_real = 1 / (s + 1.2);
sys_pair = 4 / (s^2 + 1.4 * s + 4);
sys_unstable = 1 / (s - 0.45);

[y_real, t_real] = step(sys_real, t);
[y_pair, t_pair] = step(sys_pair, t);
[y_unstable, t_unstable] = step(sys_unstable, t_unstable);

subplot(2,3,1);
hold on;
plot([-4 1], [0 0], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([0 0], [-2.5 2.5], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot(-1.2, 0, 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.06 0.46 0.43]);
title('极点 A：单个负实极点');
text(-3.7, 1.7, 'p = -1.2', 'fontsize', 12, 'color', [0.06 0.46 0.43]);
xlabel('Re(s)'); ylabel('Im(s)');
xlim([-4 1]); ylim([-2.5 2.5]); grid on;

subplot(2,3,2);
hold on;
plot([-4 1], [0 0], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([0 0], [-2.5 2.5], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([-0.7, -0.7], [1.85, -1.85], 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
title('极点 B：左半平面共轭极点');
text(-3.8, 1.7, 'p = -0.7 ± j1.85', 'fontsize', 12, 'color', [0.02 0.52 0.78]);
xlabel('Re(s)'); ylabel('Im(s)');
xlim([-4 1]); ylim([-2.5 2.5]); grid on;

subplot(2,3,3);
hold on;
plot([-1 2], [0 0], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([0 0], [-2.5 2.5], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot(0.45, 0, 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
title('极点 C：右半平面极点');
text(-0.7, 1.7, 'p = +0.45', 'fontsize', 12, 'color', [0.86 0.15 0.15]);
xlabel('Re(s)'); ylabel('Im(s)');
xlim([-1 2]); ylim([-2.5 2.5]); grid on;

subplot(2,3,4);
plot(t_real, y_real, 'color', [0.06 0.46 0.43], 'linewidth', 2.2);
title('响应 A：单调贴近稳态');
xlabel('时间 t / s'); ylabel('输出');
grid on;

subplot(2,3,5);
plot(t_pair, y_pair, 'color', [0.02 0.52 0.78], 'linewidth', 2.2);
title('响应 B：振荡衰减');
xlabel('时间 t / s'); ylabel('输出');
grid on;

subplot(2,3,6);
plot(t_unstable, y_unstable, 'color', [0.86 0.15 0.15], 'linewidth', 2.2);
title('响应 C：持续发散');
xlabel('时间 t / s'); ylabel('输出');
grid on;

axes('position', [0, 0, 1, 1], 'visible', 'off');
text(0.5, 0.98, '极点不是抽象坐标点：每种极点类型都对应不同的响应形态', 'horizontalalignment', 'center', 'fontsize', 18, 'fontweight', 'bold');
raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
mkdir(processed_dir);
svg_path = fullfile(processed_dir, '3-1-pp-02-poles-and-modes.svg');
pdf_path = fullfile(processed_dir, '3-1-pp-02-poles-and-modes.pdf');
print(fig, svg_path, '-dsvg');
print(fig, pdf_path, '-dpdf');
close(fig);
