pkg load control;

lesson_root = fileparts(fileparts(mfilename("fullpath")));
data_dir = fullfile(lesson_root, "processed", "5-1-boundary-data");
if exist(data_dir, "dir") ~= 7
  mkdir(data_dir);
endif

% Static nonlinear characteristics used in the handout.
x = linspace(-2, 2, 801)';
sat_limit = 1.0;
dead_width = 0.35;
gap_width = 0.28;

y_linear = x;
y_saturation = min(max(x, -sat_limit), sat_limit);
y_deadzone = sign(x) .* max(abs(x) - dead_width, 0);
y_hysteresis_up = x - gap_width;
y_hysteresis_down = x + gap_width;

static_table = [x, y_linear, y_saturation, y_deadzone, y_hysteresis_up, y_hysteresis_down];
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

printf("5-1 boundary data generated in %s\n", data_dir);
