pkg load control;

output_dir = fileparts(mfilename('fullpath'));
output_dir = fullfile(fileparts(output_dir), 'processed');
if ~exist(output_dir, 'dir')
  mkdir(output_dir);
endif

set(0, 'defaultfigurevisible', 'off');
set(0, 'defaultaxesfontname', 'Helvetica');
set(0, 'defaulttextfontname', 'Helvetica');
set(0, 'defaultaxesfontsize', 11);
set(0, 'defaultlinelinewidth', 1.8);

function den = main_den(k)
  den = [1 5 9 7 + k 2 + k];
endfunction

function sys = main_sys(k)
  den = main_den(k);
  num = 2 + k;
  sys = tf(num, den);
endfunction

% Figure 1: pole migration range under parameter sweep
k_values = linspace(-2, 22, 241);
stable_real = [];
stable_imag = [];
unstable_real = [];
unstable_imag = [];

for k = k_values
  r = roots(main_den(k));
  if k <= 18
    stable_real = [stable_real; real(r(:))];
    stable_imag = [stable_imag; imag(r(:))];
  else
    unstable_real = [unstable_real; real(r(:))];
    unstable_imag = [unstable_imag; imag(r(:))];
  endif
endfor

fig = figure('position', [80 80 780 540], 'color', 'w');
plot(stable_real, stable_imag, '.', 'color', [0 0.45 0.74], 'markersize', 10);
hold on;
plot(unstable_real, unstable_imag, '.', 'color', [0.85 0.33 0.10], 'markersize', 10);

r_km2 = roots(main_den(-2));
r_k18 = roots(main_den(18));
r_k22 = roots(main_den(22));
plot(real(r_km2), imag(r_km2), 'ks', 'markerfacecolor', [0.20 0.20 0.20], 'markersize', 7);
plot(real(r_k18), imag(r_k18), 'kd', 'markerfacecolor', [0.93 0.69 0.13], 'markersize', 7);
plot(real(r_k22), imag(r_k22), 'ko', 'markerfacecolor', [0.64 0.08 0.18], 'markersize', 7);

xline(0, '--', 'color', [0.35 0.35 0.35], 'linewidth', 1.0);
yline(0, '-', 'color', [0.65 0.65 0.65], 'linewidth', 0.8);
grid on;
axis equal;
xlim([-4.6 0.8]);
ylim([-3.0 3.0]);
xlabel('Real axis');
ylabel('Imag axis');
title('Pole Migration of D(s,k) under Parameter Sweep');
legend({
  'k in [-2, 18] poles',
  'k in (18, 22] poles',
  'boundary point k = -2',
  'boundary point k = 18',
  'unstable point k = 22'
}, 'location', 'southwest');
print(fig, fullfile(output_dir, '3-2-pole-migration.png'), '-dpng', '-r220');
close(fig);

% Figure 2: step responses for representative parameter values
t = 0:0.01:18;
[y12, t12] = step(main_sys(12), t);
[y18, t18] = step(main_sys(18), t);
[y22, t22] = step(main_sys(22), t);

fig = figure('position', [90 90 780 540], 'color', 'w');
plot(t12, y12, 'color', [0 0.45 0.74]);
hold on;
plot(t18, y18, 'color', [0.93 0.69 0.13]);
plot(t22, y22, 'color', [0.85 0.33 0.10]);
grid on;
xlabel('Time (s)');
ylabel('Output');
title('Step Responses for Typical Parameter Values');
legend({
  'k = 12 (stable)',
  'k = 18 (critical boundary)',
  'k = 22 (unstable)'
}, 'location', 'northwest');
print(fig, fullfile(output_dir, '3-2-step-comparison.png'), '-dpng', '-r220');
close(fig);

% Figure 3: bode magnitude near the stability boundary
w = logspace(-2, 2, 600);
[mag4, ~] = bode(main_sys(4), w);
[mag12, ~] = bode(main_sys(12), w);
[mag17d5, ~] = bode(main_sys(17.5), w);

mag4 = squeeze(20 * log10(mag4));
mag12 = squeeze(20 * log10(mag12));
mag17d5 = squeeze(20 * log10(mag17d5));

fig = figure('position', [100 100 780 540], 'color', 'w');
semilogx(w, mag4, 'color', [0.47 0.67 0.19]);
hold on;
semilogx(w, mag12, 'color', [0 0.45 0.74]);
semilogx(w, mag17d5, 'color', [0.85 0.33 0.10]);
grid on;
xlabel('Frequency (rad/s)');
ylabel('Magnitude (dB)');
title('Bode Magnitude near the Stability Boundary');
legend({
  'k = 4',
  'k = 12',
  'k = 17.5'
}, 'location', 'northwest');
print(fig, fullfile(output_dir, '3-2-bode-magnitude.png'), '-dpng', '-r220');
close(fig);
