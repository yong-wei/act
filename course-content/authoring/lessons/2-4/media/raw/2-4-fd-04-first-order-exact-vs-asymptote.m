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
w = logspace (-1, 2, 700);
T = 0.5;
wc = 1 / T;
sys = 1 / (T * s + 1);

[mag, phase_deg] = bode (sys, w);
mag_db = 20 * log10 (squeeze (mag));
phase_deg = squeeze (phase_deg);

mag_asym = zeros (size (w));
idx = w > wc;
mag_asym(idx) = -20 * log10 (w(idx) / wc);

fig = figure ('position', [100, 100, 980, 760], 'color', 'w');

subplot (2, 1, 1);
semilogx (w, mag_db, 'LineWidth', 2.0);
hold on;
semilogx (w, mag_asym, '--', 'LineWidth', 1.6);
grid on;
xlim ([0.1, 100]);
ylim ([-38, 4]);
yline = ylim ();
semilogx ([wc, wc], yline, ':', 'LineWidth', 1.0);
text (wc * 1.08, -4, '\omega_c', 'FontSize', 10);
title ('一阶惯性环节：精确幅频曲线与渐近骨架');
ylabel ('幅值 / dB');
legend ('精确曲线', '渐近骨架', 'Location', 'southwest');

subplot (2, 1, 2);
semilogx (w, phase_deg, 'LineWidth', 2.0);
grid on;
hold on;
xlim ([0.1, 100]);
ylim ([-100, 5]);
ph_ylim = ylim ();
semilogx ([0.1 * wc, 0.1 * wc], ph_ylim, ':', 'LineWidth', 1.0);
semilogx ([wc, wc], ph_ylim, ':', 'LineWidth', 1.0);
semilogx ([10 * wc, 10 * wc], ph_ylim, ':', 'LineWidth', 1.0);
text (0.1 * wc * 1.08, -88, '0.1\omega_c', 'FontSize', 10);
text (wc * 1.08, -62, '\omega_c', 'FontSize', 10);
text (10 * wc * 1.03, -88, '10\omega_c', 'FontSize', 10);
text (0.14, -16, '先抓两头，再补中间圆滑过渡', 'FontSize', 11);
xlabel ('\omega / rad/s');
ylabel ('相位 / deg');
title ('相位曲线给出同一转折附近的拖后过程');

print (fig, fullfile (outdir, '2-4-fd-04-first-order-exact-vs-asymptote.svg'), '-dsvg');
