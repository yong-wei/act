pkg load control
set(0, "defaultfigurevisible", "off");
set(0, "defaulttextfontname", "Songti SC");
set(0, "defaultaxesfontname", "Songti SC");

s = tf("s");
G = 1/(0.35*s + 1);

C0 = 1.2;
Cpi = 1.2 + 0.8/s;
Fr = 1/(0.12*s + 1);
Fd = 0.8/(0.25*s + 1);

T0 = feedback(C0*G, 1);
Tpi = feedback(Cpi*G, 1);
Sd_pi = feedback(G, Cpi);
Tpi_f = Tpi * Fr;
Sd_comp = feedback(G*(1 - Fd), Cpi);

t = 0:0.01:10;
r = min(t/3, 1) + 0.15*(t >= 5);
d = -0.25*(t >= 4);

y_base = lsim(T0, r, t);
y_pi = lsim(Tpi, r, t) + lsim(Sd_pi, d, t);
y_comp = lsim(Tpi_f, r, t) + lsim(Sd_comp, d, t);

figure(1, "position", [100, 100, 1200, 760]);
subplot(2, 1, 1);
plot(t, r, "k--", "linewidth", 1.4);
hold on;
plot(t, y_base, "linewidth", 1.4);
plot(t, y_pi, "linewidth", 1.4);
plot(t, y_comp, "linewidth", 1.4);
grid on;
xlabel("时间 / s");
ylabel("转速");
legend("给定 r(t)", "比例基线", "PI 基础结构", "PI + 给定滤波 + 扰动前馈", "location", "southeast");
title("O5 首轮仿真验证");

subplot(2, 1, 2);
plot(t, d, "r", "linewidth", 1.4);
grid on;
xlabel("时间 / s");
ylabel("扰动 d(t)");
title("项目背景扰动模型");

print(gcf, "O5-simulation-result.png", "-dpng", "-r200");
