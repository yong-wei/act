pkg load control;

script_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(script_dir, "generated-data");
if exist(out_dir, "dir") != 7
  mkdir(out_dir);
endif

dt = 0.2;
t = (0:dt:80)';
n = numel(t);

delta = zeros(n, 1);
for k = 1:n
  if t(k) < 18
    delta(k) = 8;
  elseif t(k) < 36
    delta(k) = -6;
  elseif t(k) < 56
    delta(k) = 10;
  else
    delta(k) = 3 * sin(0.22 * (t(k) - 56));
  endif
endfor
delta = max(min(delta, 12), -12);

function [psi, r] = simulate_yaw(t, delta, dt, K, T, bias)
  n = numel(t);
  psi = zeros(n, 1);
  r = zeros(n, 1);
  for k = 1:n-1
    r(k+1) = r(k) + dt * ((-r(k) + K * delta(k)) / T + bias(k));
    psi(k+1) = psi(k) + dt * r(k+1);
  endfor
endfunction

bias_nominal = zeros(n, 1);
bias_actual = 0.012 * sin(0.07 * t);
K_nominal = 0.18;
T_nominal = 8.0;
K_actual = 0.125;
T_actual = 11.5;

[psi_nominal, r_nominal] = simulate_yaw(t, delta, dt, K_nominal, T_nominal, bias_nominal);
[psi_actual, r_actual] = simulate_yaw(t, delta, dt, K_actual, T_actual, bias_actual);

train_idx = find(t <= 32);
X = [r_actual(train_idx), delta(train_idx)];
y = zeros(numel(train_idx), 1);
for i = 1:numel(train_idx)
  k = train_idx(i);
  if k < n
    y(i) = (r_actual(k+1) - r_actual(k)) / dt;
  endif
endfor
theta = X \ y;
alpha = theta(1);
beta = theta(2);
T_fit = -1 / alpha;
K_fit = beta * T_fit;

[psi_fitted, r_fitted] = simulate_yaw(t, delta, dt, K_fit, T_fit, bias_nominal);

err_nominal = psi_nominal - psi_actual;
err_fitted = psi_fitted - psi_actual;

data = [t, delta, psi_nominal, psi_actual, psi_fitted, err_nominal, err_fitted, r_nominal, r_actual, r_fitted];
header = "t,delta,psi_nominal,psi_actual,psi_fitted,err_nominal,err_fitted,r_nominal,r_actual,r_fitted";
csv_path = fullfile(out_dir, "5-4-model-mismatch-prediction.csv");
fid = fopen(csv_path, "w");
fprintf(fid, "%s\n", header);
fclose(fid);
dlmwrite(csv_path, data, "-append");

summary_path = fullfile(out_dir, "5-4-model-fit-summary.txt");
fid = fopen(summary_path, "w");
fprintf(fid, "K_nominal=%.6f\n", K_nominal);
fprintf(fid, "T_nominal=%.6f\n", T_nominal);
fprintf(fid, "K_actual=%.6f\n", K_actual);
fprintf(fid, "T_actual=%.6f\n", T_actual);
fprintf(fid, "K_fit=%.6f\n", K_fit);
fprintf(fid, "T_fit=%.6f\n", T_fit);
fprintf(fid, "max_abs_nominal_error=%.6f\n", max(abs(err_nominal)));
fprintf(fid, "max_abs_fitted_error=%.6f\n", max(abs(err_fitted)));
fclose(fid);
