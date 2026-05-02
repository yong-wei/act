pkg load control;

script_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(script_dir, "generated-data");
if exist(out_dir, "dir") != 7
  mkdir(out_dir);
endif

dt = 0.2;
t = (0:dt:180)';
n = numel(t);

function y = clip_value(x, lo, hi)
  y = min(max(x, lo), hi);
endfunction

function u = apply_rate_and_saturation(u_raw, u_prev, dt, u_limit, rate_limit)
  du_limit = rate_limit * dt;
  u = clip_value(u_raw, u_prev - du_limit, u_prev + du_limit);
  u = clip_value(u, -u_limit, u_limit);
endfunction

function [psi, r] = simulate_yaw(t, delta, dt, K, T, bias)
  n = numel(t);
  psi = zeros(n, 1);
  r = zeros(n, 1);
  for k = 1:n-1
    r(k+1) = r(k) + dt * ((-r(k) + K * delta(k)) / T + bias(k));
    psi(k+1) = psi(k) + dt * r(k+1);
  endfor
endfunction

function value = ref_at_time(t_value)
  if t_value < 5
    value = 0;
  elseif t_value < 45
    value = 12;
  elseif t_value < 78
    value = -6;
  elseif t_value < 122
    value = 10;
  elseif t_value < 152
    value = -4;
  else
    value = 6;
  endif
endfunction

function ref = build_reference(t)
  ref = zeros(numel(t), 1);
  for k = 1:numel(t)
    ref(k) = ref_at_time(t(k));
  endfor
endfunction

function [K_actual, T_actual, bias_actual] = build_actual_environment(t)
  n = numel(t);
  K_actual = zeros(n, 1);
  T_actual = zeros(n, 1);
  bias_actual = zeros(n, 1);
  for k = 1:n
    if t(k) < 28
      drift = 0;
    elseif t(k) < 108
      drift = (t(k) - 28) / 80;
    else
      drift = 1;
    endif
    K_actual(k) = 0.18 + drift * (0.065 - 0.18);
    T_actual(k) = 8.0 + drift * (18.0 - 8.0);

    if t(k) >= 34
      bias_actual(k) = 0.016 + 0.010 * sin(0.085 * (t(k) - 34));
    endif
  endfor
endfunction

function u = choose_mpc_input(psi, r, t_now, u_prev, dt, alpha, beta, gamma, u_limit, rate_limit, horizon_steps)
  lower = max(-u_limit, u_prev - rate_limit * dt);
  upper = min(u_limit, u_prev + rate_limit * dt);
  candidate_count = 33;
  candidates = linspace(lower, upper, candidate_count);
  best_cost = Inf;
  best_u = u_prev;

  for c = 1:candidate_count
    u_candidate = candidates(c);
    psi_pred = psi;
    r_pred = r;
    cost = 0;
    for h = 1:horizon_steps
      t_future = t_now + h * dt;
      r_ref = ref_at_time(t_future);
      r_pred = r_pred + dt * (alpha * r_pred + beta * u_candidate + gamma);
      psi_pred = psi_pred + dt * r_pred;
      tracking_error = psi_pred - r_ref;
      cost += 8.0 * tracking_error^2 + 0.055 * u_candidate^2;
    endfor
    cost += 0.9 * (u_candidate - u_prev)^2;
    if cost < best_cost
      best_cost = cost;
      best_u = u_candidate;
    endif
  endfor

  u = apply_rate_and_saturation(best_u, u_prev, dt, u_limit, rate_limit);
endfunction

function [K_fit, T_fit, gamma_fit] = estimate_data_model(k, r, u, dt, K_prev, T_prev, gamma_prev)
  min_samples = 24;
  window = 110;
  first = max(1, k - window);
  last = k - 1;
  sample_count = last - first + 1;

  if sample_count < min_samples
    K_fit = K_prev;
    T_fit = T_prev;
    gamma_fit = gamma_prev;
    return;
  endif

  X = zeros(sample_count, 3);
  y = zeros(sample_count, 1);
  weights = zeros(sample_count, 1);
  for idx = 1:sample_count
    j = first + idx - 1;
    X(idx, :) = [r(j), u(j), 1];
    y(idx) = r(j + 1);
    weights(idx) = 0.35 + 0.65 * (idx / sample_count)^2;
  endfor

  sqrt_w = sqrt(weights);
  Xw = X .* repmat(sqrt_w, 1, 3);
  yw = y .* sqrt_w;

  a_prev = 1 - dt / T_prev;
  b_prev = K_prev * dt / T_prev;
  c_prev = gamma_prev * dt;
  theta_prior = [a_prev; b_prev; c_prev];
  reg = 0.12;
  theta = (Xw' * Xw + reg * eye(3)) \ (Xw' * yw + reg * theta_prior);

  a_raw = clip_value(theta(1), 1 - dt / 5.0, 1 - dt / 24.0);
  T_raw = dt / max(1 - a_raw, 0.001);
  T_raw = clip_value(T_raw, 5.0, 24.0);

  b_raw = clip_value(theta(2), 0.00035, 0.0065);
  K_raw = b_raw * T_raw / dt;
  K_raw = clip_value(K_raw, 0.045, 0.22);

  gamma_raw = clip_value(theta(3) / dt, -0.04, 0.04);
  K_raw = clip_value(K_raw, K_prev - 0.008, K_prev + 0.008);
  T_raw = clip_value(T_raw, T_prev - 0.45, T_prev + 0.45);
  gamma_raw = clip_value(gamma_raw, gamma_prev - 0.0025, gamma_prev + 0.0025);

  input_span = max(u(first:last)) - min(u(first:last));
  blend = min(0.26, max(0.05, 0.26 * sample_count / window));
  if input_span < 1.0
    blend = min(blend, 0.06);
  endif

  K_fit = (1 - blend) * K_prev + blend * K_raw;
  T_fit = (1 - blend) * T_prev + blend * T_raw;
  gamma_fit = (1 - blend) * gamma_prev + blend * gamma_raw;
endfunction

function [psi, r, u] = simulate_traditional_controller(t, ref, dt, K_actual, T_actual, bias_actual)
  n = numel(t);
  psi = zeros(n, 1);
  r = zeros(n, 1);
  u = zeros(n, 1);
  integral_error = 0;
  u_limit = 12;
  rate_limit = 3.0;
  kp = 1.15;
  ki = 0.055;
  kd = 2.2;

  for k = 1:n-1
    error = ref(k) - psi(k);
    integral_error = clip_value(integral_error + error * dt, -80, 80);
    u_raw = kp * error + ki * integral_error - kd * r(k);
    u(k) = apply_rate_and_saturation(u_raw, u(max(k-1, 1)), dt, u_limit, rate_limit);
    r(k+1) = r(k) + dt * ((-r(k) + K_actual(k) * u(k)) / T_actual(k) + bias_actual(k));
    psi(k+1) = psi(k) + dt * r(k+1);
  endfor
  u(n) = u(n-1);
endfunction

function [psi, r, u, K_est, T_est, bias_est] = simulate_mpc_controller(t, dt, K_actual, T_actual, bias_actual, use_data_model)
  n = numel(t);
  psi = zeros(n, 1);
  r = zeros(n, 1);
  u = zeros(n, 1);
  K_est = zeros(n, 1);
  T_est = zeros(n, 1);
  bias_est = zeros(n, 1);
  K_nominal = 0.18;
  T_nominal = 8.0;
  alpha_nominal = -1 / T_nominal;
  beta_nominal = K_nominal / T_nominal;
  u_limit = 12;
  rate_limit = 3.0;
  horizon_steps = 80;
  K_fit = K_nominal;
  t_fit = T_nominal;
  gamma = 0;

  for k = 1:n-1
    if use_data_model
      [K_fit, t_fit, gamma] = estimate_data_model(k, r, u, dt, K_fit, t_fit, gamma);
      control_K = clip_value(0.88 * K_fit, 0.045, 0.22);
      control_T = clip_value(1.12 * t_fit, 5.0, 24.0);
      alpha = -1 / control_T;
      beta = control_K / control_T;
    else
      alpha = alpha_nominal;
      beta = beta_nominal;
      gamma = 0;
      K_fit = K_nominal;
      t_fit = T_nominal;
    endif
    K_est(k) = K_fit;
    T_est(k) = t_fit;
    bias_est(k) = gamma;

    u(k) = choose_mpc_input(psi(k), r(k), t(k), u(max(k-1, 1)), dt, alpha, beta, gamma, u_limit, rate_limit, horizon_steps);
    r(k+1) = r(k) + dt * ((-r(k) + K_actual(k) * u(k)) / T_actual(k) + bias_actual(k));
    psi(k+1) = psi(k) + dt * r(k+1);
  endfor
  u(n) = u(n-1);
  K_est(n) = K_est(n-1);
  T_est(n) = T_est(n-1);
  bias_est(n) = bias_est(n-1);
endfunction

function write_csv(path, header, data)
  fid = fopen(path, "w");
  fprintf(fid, "%s\n", header);
  fclose(fid);
  dlmwrite(path, data, "-append");
endfunction

function metrics = controller_metrics(t, ref, psi, u, dt, env_change_time)
  err = psi - ref;
  sat = abs(u) >= 11.95;
  env_idx = find(t >= env_change_time);
  metrics = [
    max(abs(err)), ...
    sum(abs(err)) * dt, ...
    mean(abs(err)), ...
    mean(sat) * 100, ...
    mean(abs(err(env_idx))), ...
    max(abs(err(env_idx)))
  ];
endfunction

% Open-loop prediction comparison retained as the entry evidence.
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

bias_nominal = zeros(n, 1);
bias_actual_prediction = 0.012 * sin(0.07 * t);
K_nominal = 0.18;
T_nominal = 8.0;
K_actual_prediction = 0.125;
T_actual_prediction = 11.5;

[psi_nominal, r_nominal] = simulate_yaw(t, delta, dt, K_nominal, T_nominal, bias_nominal);
[psi_actual, r_actual] = simulate_yaw(t, delta, dt, K_actual_prediction, T_actual_prediction, bias_actual_prediction);

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

prediction_data = [t, delta, psi_nominal, psi_actual, psi_fitted, err_nominal, err_fitted, r_nominal, r_actual, r_fitted];
prediction_header = "t,delta,psi_nominal,psi_actual,psi_fitted,err_nominal,err_fitted,r_nominal,r_actual,r_fitted";
write_csv(fullfile(out_dir, "5-4-model-mismatch-prediction.csv"), prediction_header, prediction_data);

summary_path = fullfile(out_dir, "5-4-model-fit-summary.txt");
fid = fopen(summary_path, "w");
fprintf(fid, "K_nominal=%.6f\n", K_nominal);
fprintf(fid, "T_nominal=%.6f\n", T_nominal);
fprintf(fid, "K_actual=%.6f\n", K_actual_prediction);
fprintf(fid, "T_actual=%.6f\n", T_actual_prediction);
fprintf(fid, "K_fit=%.6f\n", K_fit);
fprintf(fid, "T_fit=%.6f\n", T_fit);
fprintf(fid, "max_abs_nominal_error=%.6f\n", max(abs(err_nominal)));
fprintf(fid, "max_abs_fitted_error=%.6f\n", max(abs(err_fitted)));
fclose(fid);

% Closed-loop comparison under model drift and environment information change.
ref = build_reference(t);
[K_actual, T_actual, bias_actual] = build_actual_environment(t);

[psi_traditional, r_traditional, u_traditional] = simulate_traditional_controller(t, ref, dt, K_actual, T_actual, bias_actual);
[psi_mpc_nominal, r_mpc_nominal, u_mpc_nominal, K_est_nominal, T_est_nominal, bias_est_nominal] = simulate_mpc_controller(t, dt, K_actual, T_actual, bias_actual, false);
[psi_mpc_data, r_mpc_data, u_mpc_data, K_est_data, T_est_data, bias_est_data] = simulate_mpc_controller(t, dt, K_actual, T_actual, bias_actual, true);

err_traditional = psi_traditional - ref;
err_mpc_nominal = psi_mpc_nominal - ref;
err_mpc_data = psi_mpc_data - ref;

closed_loop_data = [
  t, ref, K_actual, T_actual, bias_actual, ...
  psi_traditional, psi_mpc_nominal, psi_mpc_data, ...
  u_traditional, u_mpc_nominal, u_mpc_data, ...
  err_traditional, err_mpc_nominal, err_mpc_data, ...
  r_traditional, r_mpc_nominal, r_mpc_data, ...
  K_est_data, T_est_data, bias_est_data
];
closed_loop_header = "t,ref,K_actual,T_actual,bias_actual,psi_traditional,psi_mpc_nominal,psi_mpc_data,u_traditional,u_mpc_nominal,u_mpc_data,err_traditional,err_mpc_nominal,err_mpc_data,r_traditional,r_mpc_nominal,r_mpc_data,K_est_data,T_est_data,bias_est_data";
write_csv(fullfile(out_dir, "5-4-mpc-drift-comparison.csv"), closed_loop_header, closed_loop_data);

metric_traditional = controller_metrics(t, ref, psi_traditional, u_traditional, dt, 28);
metric_mpc_nominal = controller_metrics(t, ref, psi_mpc_nominal, u_mpc_nominal, dt, 28);
metric_mpc_data = controller_metrics(t, ref, psi_mpc_data, u_mpc_data, dt, 28);
metrics = [
  metric_traditional;
  metric_mpc_nominal;
  metric_mpc_data
];
metrics_path = fullfile(out_dir, "5-4-mpc-drift-metrics.csv");
fid = fopen(metrics_path, "w");
fprintf(fid, "method,max_abs_error,IAE,mean_abs_error,saturation_percent,mean_abs_error_after_environment_change,max_abs_error_after_environment_change\n");
fprintf(fid, "traditional_fixed,%.6f,%.6f,%.6f,%.6f,%.6f,%.6f\n", metrics(1, :));
fprintf(fid, "nominal_model_mpc,%.6f,%.6f,%.6f,%.6f,%.6f,%.6f\n", metrics(2, :));
fprintf(fid, "data_driven_model_mpc,%.6f,%.6f,%.6f,%.6f,%.6f,%.6f\n", metrics(3, :));
fclose(fid);
