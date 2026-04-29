pkg load control;

lesson_root = fileparts(fileparts(mfilename("fullpath")));
data_dir = fullfile(lesson_root, "processed", "5-1-boundary-data");
if exist(data_dir, "dir") ~= 7
  mkdir(data_dir);
endif

% Static and quasi-static nonlinear characteristics used in the handout.
x = linspace(-2, 2, 801)';
sat_limit = 1.0;
dead_width = 0.35;
gap_width = 0.28;
relay_width = 0.30;
quant_step = 0.35;

y_linear = x;
y_saturation = min(max(x, -sat_limit), sat_limit);
y_deadzone = sign(x) .* max(abs(x) - dead_width, 0);
y_relay = sign(x);
y_relay(abs(x) < 1e-12) = 0;
y_relay_hysteresis_up = -ones(size(x));
y_relay_hysteresis_up(x >= relay_width) = 1;
y_relay_hysteresis_down = ones(size(x));
y_relay_hysteresis_down(x <= -relay_width) = -1;
y_backlash_up = x - gap_width;
y_backlash_down = x + gap_width;
y_friction = 0.58 * x + 0.28 * sign(x);
y_friction(abs(x) < 1e-12) = 0;
y_rate_limit = sign(x) .* min(abs(x), 0.70);
y_quantization = quant_step * round(x / quant_step);
y_smooth_gain = tanh(1.35 * x);
y_piecewise_gain = zeros(size(x));
for i = 1:length(x)
  if abs(x(i)) <= 0.65
    y_piecewise_gain(i) = 0.55 * x(i);
  elseif x(i) > 0.65
    y_piecewise_gain(i) = 0.55 * 0.65 + 1.18 * (x(i) - 0.65);
  else
    y_piecewise_gain(i) = -0.55 * 0.65 + 1.18 * (x(i) + 0.65);
  endif
endfor

static_table = [
  x, y_linear, y_saturation, y_deadzone, y_relay, ...
  y_relay_hysteresis_up, y_relay_hysteresis_down, ...
  y_backlash_up, y_backlash_down, y_friction, y_rate_limit, ...
  y_quantization, y_smooth_gain, y_piecewise_gain
];
csvwrite(fullfile(data_dir, "static_characteristics.csv"), static_table);

% First-order closed loop with proportional controller and actuator saturation.
% Plant: tau dy/dt = -y + u, controller: u = Kp(r-y).
tau = 2.0;
Kp = 2.0;
u_max = 1.2;
dt = 0.01;
t = (0:dt:16)';

function [y_linear, y_saturated, u_linear, u_saturated] = simulate_case(t, dt, tau, Kp, u_max, r)
  n = length(t);
  y_linear = zeros(n, 1);
  y_saturated = zeros(n, 1);
  u_linear = zeros(n, 1);
  u_saturated = zeros(n, 1);
  for k = 1:n-1
    u_linear(k) = Kp * (r - y_linear(k));
    u_saturated(k) = min(max(Kp * (r - y_saturated(k)), -u_max), u_max);
    y_linear(k+1) = y_linear(k) + dt * (-y_linear(k) + u_linear(k)) / tau;
    y_saturated(k+1) = y_saturated(k) + dt * (-y_saturated(k) + u_saturated(k)) / tau;
  endfor
  u_linear(n) = Kp * (r - y_linear(n));
  u_saturated(n) = min(max(Kp * (r - y_saturated(n)), -u_max), u_max);
endfunction

[y_lin_small, y_sat_small, u_lin_small, u_sat_small] = simulate_case(t, dt, tau, Kp, u_max, 0.3);
[y_lin_large, y_sat_large, u_lin_large, u_sat_large] = simulate_case(t, dt, tau, Kp, u_max, 1.2);

response_table = [
  t, ...
  y_lin_small, y_sat_small, u_lin_small, u_sat_small, ...
  y_lin_large, y_sat_large, u_lin_large, u_sat_large
];
csvwrite(fullfile(data_dir, "saturation_response.csv"), response_table);

function u = apply_nonlinearity(v, kind)
  if strcmp(kind, "smooth")
    u = tanh(v);
  elseif strcmp(kind, "relay")
    u = sign(v);
    u(abs(v) < 1e-12) = 0;
  else
    u = v;
  endif
endfunction

function y = simulate_forcing(t, dt, tau, v, kind, linear_gain)
  n = length(t);
  y = zeros(n, 1);
  for k = 1:n-1
    if strcmp(kind, "linear")
      u = linear_gain * v(k);
    else
      u = apply_nonlinearity(v(k), kind);
    endif
    y(k+1) = y(k) + dt * (-y(k) + u) / tau;
  endfor
endfunction

function table = make_time_compare(t, dt, tau, kind, linear_gain)
  small_step = 0.20 * ones(size(t));
  large_step = 1.35 * ones(size(t));
  sine_input = 0.85 * sin(1.2 * t);
  y_nl_small = simulate_forcing(t, dt, tau, small_step, kind, linear_gain);
  y_lin_small = simulate_forcing(t, dt, tau, small_step, "linear", linear_gain);
  y_nl_large = simulate_forcing(t, dt, tau, large_step, kind, linear_gain);
  y_lin_large = simulate_forcing(t, dt, tau, large_step, "linear", linear_gain);
  y_nl_sine = simulate_forcing(t, dt, tau, sine_input, kind, linear_gain);
  y_lin_sine = simulate_forcing(t, dt, tau, sine_input, "linear", linear_gain);
  table = [
    t, y_nl_small, y_lin_small, y_nl_large, y_lin_large, ...
    y_nl_sine, y_lin_sine
  ];
endfunction

function [gain_db, phase_deg] = estimate_sine_response(w, amp, tau, kind, linear_gain)
  period = 2 * pi / w;
  dt_local = min(0.01, period / 160);
  t_local = (0:dt_local:(18 * period))';
  v = amp * sin(w * t_local);
  y = simulate_forcing(t_local, dt_local, tau, v, kind, linear_gain);
  keep = t_local >= 10 * period;
  ts = t_local(keep);
  ys = y(keep);
  basis = [sin(w * ts), cos(w * ts), ones(size(ts))];
  coeff = basis \ ys;
  output_amp = sqrt(coeff(1)^2 + coeff(2)^2);
  gain_db = 20 * log10(max(output_amp / amp, 1e-8));
  phase_deg = atan2(coeff(2), coeff(1)) * 180 / pi;
endfunction

function table = make_bode_compare(tau, kind, linear_gain)
  w = logspace(-1, 1, 48)';
  linear_gain_abs = linear_gain ./ sqrt(1 + (tau * w) .^ 2);
  linear_phase = -atan(tau * w) * 180 / pi;
  linear_mag_db = 20 * log10(linear_gain_abs);
  small_mag = zeros(size(w));
  small_phase = zeros(size(w));
  large_mag = zeros(size(w));
  large_phase = zeros(size(w));
  for i = 1:length(w)
    [small_mag(i), small_phase(i)] = estimate_sine_response(w(i), 0.20, tau, kind, linear_gain);
    [large_mag(i), large_phase(i)] = estimate_sine_response(w(i), 1.20, tau, kind, linear_gain);
  endfor
  table = [w, linear_mag_db, linear_phase, small_mag, small_phase, large_mag, large_phase];
endfunction

linearization_t = (0:dt:18)';
csvwrite(
  fullfile(data_dir, "smooth_linearization_time.csv"),
  make_time_compare(linearization_t, dt, tau, "smooth", 1.0)
);
csvwrite(
  fullfile(data_dir, "smooth_linearization_bode.csv"),
  make_bode_compare(tau, "smooth", 1.0)
);
csvwrite(
  fullfile(data_dir, "relay_bad_linearization_time.csv"),
  make_time_compare(linearization_t, dt, tau, "relay", 1.0)
);
csvwrite(
  fullfile(data_dir, "relay_bad_linearization_bode.csv"),
  make_bode_compare(tau, "relay", 1.0)
);

function [y_linear, y_nonlinear, u_linear, u_nonlinear] = simulate_deadzone_feedback(t, dt)
  tau_local = 2.0;
  kp_local = 2.0;
  delta = 0.2;
  r = 0.12;
  n = length(t);
  y_linear = zeros(n, 1);
  y_nonlinear = zeros(n, 1);
  u_linear = zeros(n, 1);
  u_nonlinear = zeros(n, 1);
  for k = 1:n-1
    v_linear = kp_local * (r - y_linear(k));
    v_nonlinear = kp_local * (r - y_nonlinear(k));
    u_linear(k) = v_linear;
    u_nonlinear(k) = sign(v_nonlinear) * max(abs(v_nonlinear) - delta, 0);
    y_linear(k+1) = y_linear(k) + dt * (-y_linear(k) + u_linear(k)) / tau_local;
    y_nonlinear(k+1) = y_nonlinear(k) + dt * (-y_nonlinear(k) + u_nonlinear(k)) / tau_local;
  endfor
  u_linear(n) = kp_local * (r - y_linear(n));
  v_nonlinear = kp_local * (r - y_nonlinear(n));
  u_nonlinear(n) = sign(v_nonlinear) * max(abs(v_nonlinear) - delta, 0);
endfunction

function [y_linear, y_nonlinear, u_linear, u_nonlinear] = simulate_relay_feedback(t, dt)
  tau_local = 2.0;
  kp_local = 2.0;
  relay_amp = 1.0;
  hysteresis = 0.05;
  r = 0.5;
  n = length(t);
  y_linear = zeros(n, 1);
  y_nonlinear = zeros(n, 1);
  u_linear = zeros(n, 1);
  u_nonlinear = zeros(n, 1);
  relay_state = relay_amp;
  for k = 1:n-1
    e_linear = r - y_linear(k);
    e_nonlinear = r - y_nonlinear(k);
    if e_nonlinear > hysteresis
      relay_state = relay_amp;
    elseif e_nonlinear < -hysteresis
      relay_state = -relay_amp;
    endif
    u_linear(k) = kp_local * e_linear;
    u_nonlinear(k) = relay_state;
    y_linear(k+1) = y_linear(k) + dt * (-y_linear(k) + u_linear(k)) / tau_local;
    y_nonlinear(k+1) = y_nonlinear(k) + dt * (-y_nonlinear(k) + u_nonlinear(k)) / tau_local;
  endfor
  u_linear(n) = kp_local * (r - y_linear(n));
  u_nonlinear(n) = relay_state;
endfunction

function [y_linear, y_nonlinear, u_linear, u_nonlinear, v_command] = simulate_rate_limit_feedback(t, dt)
  tau_local = 2.0;
  kp_local = 2.0;
  act_tau = 0.2;
  rate_limit = 0.35;
  r = 1.0;
  n = length(t);
  y_linear = zeros(n, 1);
  y_nonlinear = zeros(n, 1);
  u_linear = zeros(n, 1);
  u_nonlinear = zeros(n, 1);
  v_command = zeros(n, 1);
  for k = 1:n-1
    u_linear(k) = kp_local * (r - y_linear(k));
    v_command(k) = kp_local * (r - y_nonlinear(k));
    desired_rate = (v_command(k) - u_nonlinear(k)) / act_tau;
    limited_rate = min(max(desired_rate, -rate_limit), rate_limit);
    u_nonlinear(k+1) = u_nonlinear(k) + dt * limited_rate;
    y_linear(k+1) = y_linear(k) + dt * (-y_linear(k) + u_linear(k)) / tau_local;
    y_nonlinear(k+1) = y_nonlinear(k) + dt * (-y_nonlinear(k) + u_nonlinear(k)) / tau_local;
  endfor
  u_linear(n) = kp_local * (r - y_linear(n));
  v_command(n) = kp_local * (r - y_nonlinear(n));
endfunction

closed_loop_t = (0:dt:20)';
[y_lin_dead, y_dead, u_lin_dead, u_dead] = simulate_deadzone_feedback(closed_loop_t, dt);
csvwrite(
  fullfile(data_dir, "deadzone_feedback_compare.csv"),
  [closed_loop_t, y_lin_dead, y_dead, u_lin_dead, u_dead]
);

[y_lin_relay, y_relay, u_lin_relay, u_relay] = simulate_relay_feedback(closed_loop_t, dt);
csvwrite(
  fullfile(data_dir, "relay_hysteresis_feedback_compare.csv"),
  [closed_loop_t, y_lin_relay, y_relay, u_lin_relay, u_relay]
);

[y_lin_rate, y_rate, u_lin_rate, u_rate, v_rate] = simulate_rate_limit_feedback(closed_loop_t, dt);
csvwrite(
  fullfile(data_dir, "rate_limit_feedback_compare.csv"),
  [closed_loop_t, y_lin_rate, y_rate, u_lin_rate, u_rate, v_rate]
);

printf("5-1 boundary data generated in %s\n", data_dir);
