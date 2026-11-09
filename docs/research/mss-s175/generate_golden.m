% 生成 S175 基准黄金轨迹（issue-2157 阶段B 路径2）。
% 与 MSS SIMcontainer.m 相同设置：非线性模型 + PD 航向控制 + RK4 h=0.1。
T_final = 600; h = 0.1;
Kp = 1; Td = 10;
x1 = [7 0 0 0 0 0 0 0 0 70]';
t = 0:h:T_final;
nTimeSteps = length(t);
simdata = zeros(nTimeSteps, 10);
for i = 1:nTimeSteps
    r = x1(3); psi = x1(6);
    psi_ref = deg2rad(5);
    delta_c = -Kp * (ssa(psi - psi_ref) + Td * r);
    n_c = 70;
    simdata(i,:) = x1';
    x1 = rk4(@container, h, x1, [delta_c n_c]);
end
% 每 1s 输出一行（601 行），10 通道 + 时间。
fid = fopen('golden_trajectory.csv', 'w');
for i = 1:10:nTimeSteps
    fprintf(fid, '%.10e,%.10e,%.10e,%.10e,%.10e,%.10e,%.10e,%.10e,%.10e,%.10e,%.10e\n', ...
        t(i), simdata(i,1), simdata(i,2), simdata(i,3), simdata(i,4), ...
        simdata(i,5), simdata(i,6), simdata(i,7), simdata(i,8), simdata(i,9), simdata(i,10));
end
fclose(fid);
disp('golden_trajectory.csv written');
