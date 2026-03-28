% Octave 用户若未预加载控制工具箱，请先执行：pkg load control
s = tf('s');
G = 4 / (s * (0.5 * s + 1) * (0.2 * s + 1));
T = feedback(G, 1);

[gm, pm, w_g, w_c] = margin(G);
gm_db = 20 * log10(gm);

w = logspace(-2, 2, 4000);
[mag, ~] = bode(T, w);
mag = squeeze(mag);
target = dcgain(T) / sqrt(2);
idx = find(mag <= target, 1, 'first');
w_b = w(idx);

fprintf('gm = %.6f, gm_db = %.6f dB\n', gm, gm_db);
fprintf('pm = %.6f deg\n', pm);
fprintf('w_g = %.6f rad/s\n', w_g);
fprintf('w_c = %.6f rad/s\n', w_c);
fprintf('w_b = %.6f rad/s\n', w_b);
