1;
pkg load control;

set(0, 'defaultaxesfontname', 'Microsoft YaHei');
set(0, 'defaulttextfontname', 'Microsoft YaHei');
s = tf('s');
w = logspace(-2, 2, 700);
w_nat = sqrt(3.2);
w_break_far = 5;
w_break_near = 1.4;

sys_ref = 3.2 / (s^2 + 1.6 * s + 3.2);
sys_far = 16 / ((s + 5) * (s^2 + 1.6 * s + 3.2));
sys_near = 4.48 / ((s + 1.4) * (s^2 + 1.6 * s + 3.2));

[mag_ref, phase_ref] = bode(sys_ref, w);
[mag_far, phase_far] = bode(sys_far, w);
[mag_near, phase_near] = bode(sys_near, w);

mag_ref = squeeze(mag_ref);
mag_far = squeeze(mag_far);
mag_near = squeeze(mag_near);
phase_ref = squeeze(phase_ref);
phase_far = squeeze(phase_far);
phase_near = squeeze(phase_near);

mag_db_ref = 20 * log10(mag_ref);
mag_db_far = 20 * log10(mag_far);
mag_db_near = 20 * log10(mag_near);
target_db = -3;
bw_idx = find(mag_db_ref <= target_db, 1);
if isempty(bw_idx)
  w_bw_ref = NaN;
else
  w_bw_ref = w(bw_idx);
endif

fig = figure('visible', 'off', 'color', [0.9725, 0.9804, 0.9882], 'position', [80, 80, 1180, 760]);
set(fig, 'paperunits', 'points');
set(fig, 'papersize', [1180, 760]);
set(fig, 'paperposition', [0, 0, 1180, 760]);

subplot(2, 1, 1);
hold on;
semilogx(w, mag_db_ref, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
semilogx(w, mag_db_far, 'linewidth', 2.2, 'color', [0.06 0.46 0.43]);
semilogx(w, mag_db_near, 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
plot([w_nat w_nat], [-50 20], ':', 'linewidth', 1.5, 'color', [0.02 0.52 0.78]);
plot([w_break_far w_break_far], [-50 20], '--', 'linewidth', 1.7, 'color', [0.06 0.46 0.43]);
plot([w_break_near w_break_near], [-50 20], '--', 'linewidth', 1.7, 'color', [0.86 0.15 0.15]);
plot([w_bw_ref w_bw_ref], [-50 20], '-.', 'linewidth', 1.7, 'color', [0.45 0.45 0.45]);
text(w_nat * 1.03, 6.0, '\omega_n \approx 1.79', 'fontsize', 11, 'color', [0.02 0.52 0.78]);
text(w_break_near * 1.03, -3.0, '\omega = 1.4', 'fontsize', 11, 'color', [0.86 0.15 0.15]);
text(w_break_far * 1.03, -11.0, '\omega = 5', 'fontsize', 11, 'color', [0.06 0.46 0.43]);
text(w_bw_ref * 1.03, 2.0, sprintf('\\omega_{bw} \\approx %.2f', w_bw_ref), 'fontsize', 11, 'color', [0.35 0.35 0.35]);
title('幅频对比：附加极点转折频率若落入带宽内，低阶近似会明显失真');
xlabel('角频率 \omega / rad·s^{-1}');
ylabel('幅值 / dB');
legend('仅主导二阶模型', '附加极点在 -5', '附加极点在 -1.4', 'location', 'southwest');
ylim([-40 10]);
grid on;

subplot(2, 1, 2);
hold on;
semilogx(w, phase_ref, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
semilogx(w, phase_far, 'linewidth', 2.2, 'color', [0.06 0.46 0.43]);
semilogx(w, phase_near, 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
plot([w_nat w_nat], [-270 10], ':', 'linewidth', 1.5, 'color', [0.02 0.52 0.78]);
plot([w_break_far w_break_far], [-270 10], '--', 'linewidth', 1.7, 'color', [0.06 0.46 0.43]);
plot([w_break_near w_break_near], [-270 10], '--', 'linewidth', 1.7, 'color', [0.86 0.15 0.15]);
plot([w_bw_ref w_bw_ref], [-270 10], '-.', 'linewidth', 1.7, 'color', [0.45 0.45 0.45]);
text(w_break_near * 1.03, -118, '\omega = 1.4 已进入主要带宽', 'fontsize', 10, 'color', [0.86 0.15 0.15]);
text(w_break_far * 1.03, -175, '\omega = 5 位于带宽外侧', 'fontsize', 10, 'color', [0.06 0.46 0.43]);
title('相频对比：附加极点越靠近带宽，相位提前下沉越明显');
xlabel('角频率 \omega / rad·s^{-1}');
ylabel('相位 / deg');
ylim([-250 10]);
grid on;

axes('position', [0, 0, 1, 1], 'visible', 'off');
text(0.5, 0.98, '高阶系统能否近似成低阶系统，要看附加极点的转折频率是否侵入主要带宽', 'horizontalalignment', 'center', 'fontsize', 18, 'fontweight', 'bold');

raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
mkdir(processed_dir);
svg_path = fullfile(processed_dir, '3-1-pp-05-bode-model-reduction.svg');
pdf_path = fullfile(processed_dir, '3-1-pp-05-bode-model-reduction.pdf');
print(fig, svg_path, '-dsvg');
print(fig, pdf_path, '-dpdf');
close(fig);
