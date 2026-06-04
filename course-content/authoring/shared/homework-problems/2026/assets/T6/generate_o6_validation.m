pkg load control
set(0, "defaultfigurevisible", "off");
set(0, "defaulttextfontname", "Songti SC");
set(0, "defaultaxesfontname", "Songti SC");

s = tf("s");
G0 = 1/(0.35*s + 1);
Gm = 1/(0.75*s + 1);      % 新工况：等效惯量增大
C0 = 1.2 + 0.8/s;          % O5 首轮 PI
C1 = 1.1 + 0.45/s;         % O6 修正入口

T0 = feedback(C0*G0, 1);
Tm0 = feedback(C0*Gm, 1);
Tm1 = feedback(C1*Gm, 1);
t = 0:0.01:10;

figure(1, "position", [100, 100, 1200, 760]);
step(T0, Tm0, Tm1, t);
grid on;
xlabel("时间 / s");
ylabel("归一化输出");
legend("O5 原工况", "O6 迁移后未修正", "O6 修正候选", "location", "southeast");
title("O6 迁移验证阶跃响应");

print(gcf, "O6-validation.png", "-dpng", "-r200");
