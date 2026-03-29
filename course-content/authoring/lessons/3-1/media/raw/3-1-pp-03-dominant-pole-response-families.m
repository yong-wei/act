1;
pkg load control;

set(0, 'defaultaxesfontname', 'Microsoft YaHei');
set(0, 'defaulttextfontname', 'Microsoft YaHei');
s = tf('s');
t = 0:0.01:12;
sys_ref = 3.2 / (s^2 + 1.6 * s + 3.2);
sys_far = 16 / ((s + 5) * (s^2 + 1.6 * s + 3.2));
sys_near = 4.48 / ((s + 1.4) * (s^2 + 1.6 * s + 3.2));

[y_ref, t_ref] = step(sys_ref, t);
[y_far, t_far] = step(sys_far, t);
[y_near, t_near] = step(sys_near, t);

fig = figure('visible', 'off', 'color', [0.9725, 0.9804, 0.9882], 'position', [80, 80, 1180, 720]);
set(fig, 'paperunits', 'points');
set(fig, 'papersize', [1180, 720]);
set(fig, 'paperposition', [0, 0, 1180, 720]);
subplot(1,2,1);
hold on;
plot([-6 1], [0 0], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([0 0], [-3 3], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([-0.8, -0.8], [1.6, -1.6], 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
plot(-5, 0, 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.06 0.46 0.43]);
plot(-1.4, 0, 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
text(-5.7, 2.2, '远离主导对的快速极点', 'fontsize', 12, 'color', [0.06 0.46 0.43]);
text(-2.3, 2.6, '离主导对不够远的非主导极点', 'fontsize', 12, 'color', [0.86 0.15 0.15]);
title('三组极点位置对比');
xlabel('Re(s)'); ylabel('Im(s)');
xlim([-6 1]); ylim([-3 3]); grid on;

subplot(1,2,2);
hold on;
plot(t_ref, y_ref, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
plot(t_far, y_far, 'linewidth', 2.2, 'color', [0.06 0.46 0.43]);
plot(t_near, y_near, 'linewidth', 2.2, 'color', [0.86 0.15 0.15]);
title('主导极点近似何时更可靠');
xlabel('时间 t / s'); ylabel('单位阶跃响应');
legend('只看主导对', '附加极点很靠左', '附加极点不够靠左', 'location', 'southeast');
grid on;

axes('position', [0, 0, 1, 1], 'visible', 'off');
text(0.5, 0.98, '非主导极点退场得越快，主导极点近似越可靠', 'horizontalalignment', 'center', 'fontsize', 18, 'fontweight', 'bold');
raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
mkdir(processed_dir);
svg_path = fullfile(processed_dir, '3-1-pp-03-dominant-pole-response-families.svg');
pdf_path = fullfile(processed_dir, '3-1-pp-03-dominant-pole-response-families.pdf');
print(fig, svg_path, '-dsvg');
print(fig, pdf_path, '-dpdf');
close(fig);
