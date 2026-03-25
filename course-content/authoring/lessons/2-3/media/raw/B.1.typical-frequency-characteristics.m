% Octave users: pkg load control
s = tf('s');
w = logspace(-2, 2, 800);

Gk = 2;
Gi = 1 / s;
Gd = s;
G1 = 1 / (0.5*s + 1);
G2 = 25 / (s^2 + 4*s + 25);

subplot(2,1,1);
hold on;
semilogx(w, squeeze(abs(freqresp(Gk, w))), 'LineWidth', 1.6);
semilogx(w, squeeze(abs(freqresp(Gi, w))), 'LineWidth', 1.6);
semilogx(w, squeeze(abs(freqresp(Gd, w))), 'LineWidth', 1.6);
semilogx(w, squeeze(abs(freqresp(G1, w))), 'LineWidth', 1.6);
semilogx(w, squeeze(abs(freqresp(G2, w))), 'LineWidth', 1.6);
title('典型环节幅频特性');
grid on;

subplot(2,1,2);
hold on;
semilogx(w, squeeze(angle(freqresp(Gk, w))) * 180/pi, 'LineWidth', 1.6);
semilogx(w, squeeze(angle(freqresp(Gi, w))) * 180/pi, 'LineWidth', 1.6);
semilogx(w, squeeze(angle(freqresp(Gd, w))) * 180/pi, 'LineWidth', 1.6);
semilogx(w, squeeze(angle(freqresp(G1, w))) * 180/pi, 'LineWidth', 1.6);
semilogx(w, squeeze(angle(freqresp(G2, w))) * 180/pi, 'LineWidth', 1.6);
title('典型环节相频特性');
grid on;
legend('比例', '积分', '微分', '一阶惯性', '振荡环节');
