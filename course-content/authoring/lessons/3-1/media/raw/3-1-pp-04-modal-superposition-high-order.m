1;
pkg load control;

set(0, 'defaultaxesfontname', 'Microsoft YaHei');
set(0, 'defaulttextfontname', 'Microsoft YaHei');
num = 12;
den = conv([1, 1], conv([1, 2], [1, 6]));
[r, p, ~] = residue(num, den);
t = linspace(0, 6, 900);
y_total = zeros(size(t));
colors = [
  0.02, 0.52, 0.78;
  0.06, 0.46, 0.43;
  0.86, 0.15, 0.15
];

fig = figure('visible', 'off', 'color', [0.9725, 0.9804, 0.9882], 'position', [80, 80, 1180, 720]);
set(fig, 'paperunits', 'points');
set(fig, 'papersize', [1180, 720]);
set(fig, 'paperposition', [0, 0, 1180, 720]);
subplot(1,2,1);
hold on;
for k = 1:numel(p)
  y_k = real(r(k) * exp(p(k) * t));
  y_total = y_total + y_k;
  plot(t, y_k, '--', 'linewidth', 2.0, 'color', colors(k, :));
end
plot(t, y_total, 'k', 'linewidth', 2.8);
title('G(s)=12/((s+1)(s+2)(s+6)) 的脉冲响应分量');
xlabel('时间 t / s'); ylabel('g(t)');
legend('2.4e^{-t}', '-3e^{-2t}', '0.6e^{-6t}', '总响应', 'location', 'northeast');
grid on;

subplot(1,2,2);
hold on;
plot(real(p), imag(p), 'x', 'markersize', 12, 'linewidth', 2.2, 'color', [0.02 0.52 0.78]);
label_dx = [0.15, 0.15, -1.30];
label_dy = [0.12, 0.12, 0.18];
for k = 1:numel(p)
  text(real(p(k)) + label_dx(k), imag(p(k)) + label_dy(k), sprintf('p_%d = %.1f, A_%d = %.1f', k, real(p(k)), k, real(r(k))), 'fontsize', 11);
end
plot([-7 1], [0 0], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
plot([0 0], [-3 3], 'color', [0.28 0.34 0.40], 'linewidth', 1.2);
text(-6.7, 2.1, '负模态分量来自负留数', 'fontsize', 12, 'color', [0.86 0.15 0.15]);
text(-6.7, 1.7, '不意味着出现右半平面极点', 'fontsize', 12, 'color', [0.86 0.15 0.15]);
title('极点位置决定衰减节奏，留数符号决定模态叠加方向');
xlabel('Re(s)'); ylabel('Im(s)');
xlim([-7 1]); ylim([-3 3]); grid on;

axes('position', [0, 0, 1, 1], 'visible', 'off');
text(0.5, 0.98, '高阶响应可以看成多个模态叠加：极点给出节奏，留数决定每个模态如何加到总响应里', 'horizontalalignment', 'center', 'fontsize', 18, 'fontweight', 'bold');
raw_dir = fileparts(mfilename('fullpath'));
processed_dir = fullfile(raw_dir, '..', 'processed');
mkdir(processed_dir);
svg_path = fullfile(processed_dir, '3-1-pp-04-modal-superposition-high-order.svg');
pdf_path = fullfile(processed_dir, '3-1-pp-04-modal-superposition-high-order.pdf');
print(fig, svg_path, '-dsvg');
print(fig, pdf_path, '-dpdf');
close(fig);
