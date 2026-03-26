clear; close all; clc;
pkg load control;

set (0, 'defaultfigurevisible', 'off');
set (0, 'defaultaxesfontname', 'PingFang SC');
set (0, 'defaulttextfontname', 'PingFang SC');

[script_dir, ~, ~] = fileparts (mfilename ('fullpath'));
outdir = fullfile (script_dir, '..', 'processed');
if ~exist (outdir, 'dir')
  mkdir (outdir);
end

s = tf ('s');
w = logspace (-3, 2.3, 1200);
g1 = 1 / (0.5 * s + 1);
g2 = 1 / ((0.5 * s + 1) ^ 2);
g3 = 1 / ((0.5 * s + 1) ^ 3);

[re1, im1] = nyquist (g1, w); r1 = squeeze (re1) + 1i * squeeze (im1);
[re2, im2] = nyquist (g2, w); r2 = squeeze (re2) + 1i * squeeze (im2);
[re3, im3] = nyquist (g3, w); r3 = squeeze (re3) + 1i * squeeze (im3);

fig = figure ('position', [100, 100, 860, 720], 'color', 'w');
plot (real (r1), imag (r1), 'LineWidth', 2.0);
hold on;
plot (real (r2), imag (r2), 'LineWidth', 2.0);
plot (real (r3), imag (r3), 'LineWidth', 2.0);
grid on;
axis equal;
xlabel ('Re');
ylabel ('Im');
title ('纯极点系统 Nyquist 阶次对照');
xlim ([-0.25, 1.05]);
ylim ([-1.1, 0.45]);
legend ('一阶纯极点', '二阶纯极点', '三阶纯极点', 'Location', 'southwest');

text (0.76, -0.28, '一阶', 'FontSize', 11);
text (0.08, -0.88, '二阶', 'FontSize', 11);
text (-0.18, 0.18, '三阶', 'FontSize', 11);
text (0.46, 0.36, '极点越多，轨迹转得越深', 'FontSize', 11);

print (fig, fullfile (outdir, 'fd-06-pure-pole-nyquist-comparison.svg'), '-dsvg');
