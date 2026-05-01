rand("seed", 5301);
randn("seed", 5301);

root_dir = fileparts(mfilename("fullpath"));
data_dir = fullfile(root_dir, "generated-data");
if exist(data_dir, "dir") ~= 7
  mkdir(data_dir);
endif

function write_table(path, header, data)
  fid = fopen(path, "w");
  fprintf(fid, "%s\n", header);
  fclose(fid);
  dlmwrite(path, data, "-append", "delimiter", ",", "precision", 8);
endfunction

function y = clamp(x, lo, hi)
  y = min(max(x, lo), hi);
endfunction

function y = rate_limit(prev, target, max_rate, dt)
  step = clamp(target - prev, -max_rate * dt, max_rate * dt);
  y = prev + step;
endfunction

function a = wrap_pi(a)
  while a > pi
    a = a - 2 * pi;
  endwhile
  while a < -pi
    a = a + 2 * pi;
  endwhile
endfunction

function out = simulate_sensor_case(use_filter)
  dt = 0.02;
  t = (0:dt:20)';
  n = length(t);
  r = zeros(n, 1);
  y = zeros(n, 1);
  ym = zeros(n, 1);
  yf = zeros(n, 1);
  feedback = zeros(n, 1);
  e = zeros(n, 1);
  u = zeros(n, 1);
  delta = zeros(n, 1);
  tau = 1.55;
  act_tau = 0.25;
  kp = 2.15;
  noise = 0.055 * randn(n, 1) + 0.018 * sin(2 * pi * 4.4 * t);
  for k = 1:n
    if t(k) < 4
      r(k) = 0.15;
    elseif t(k) < 12
      r(k) = 0.72;
    else
      r(k) = 0.42;
    endif
    if k > 1
      ym(k) = y(k - 1) + noise(k);
      yf(k) = yf(k - 1) + dt / 0.55 * (ym(k) - yf(k - 1));
      if use_filter
        feedback(k) = yf(k);
      else
        feedback(k) = ym(k);
      endif
      e(k) = r(k) - feedback(k);
      u(k) = kp * e(k);
      delta(k) = delta(k - 1) + dt / act_tau * (u(k) - delta(k - 1));
      y(k) = y(k - 1) + dt / tau * (delta(k) - y(k - 1));
    else
      ym(k) = y(k) + noise(k);
      yf(k) = ym(k);
      feedback(k) = ym(k);
      e(k) = r(k) - feedback(k);
      u(k) = kp * e(k);
      delta(k) = u(k);
    endif
  endfor
  out = [t, r, y, ym, yf, feedback, e, u, delta];
endfunction

function out = simulate_delay_case(measure_delay)
  dt = 0.05;
  t = (0:dt:115)';
  n = length(t);
  v = 3.2;
  kp = 2.0;
  kd = 8.0;
  delta_max = 24 * pi / 180;
  rudder_tau = 2.4;
  yaw_tau = 5.6;
  yaw_gain = 0.26;
  delay_steps = round(measure_delay / dt);
  psi_ref = zeros(n, 1);
  psi = zeros(n, 1);
  psi_meas = zeros(n, 1);
  r = zeros(n, 1);
  delta = zeros(n, 1);
  x = zeros(n, 1);
  y = zeros(n, 1);
  cmd = zeros(n, 1);
  for k = 1:n
    psi_ref(k) = (24 / (1 + exp(-0.32 * (t(k) - 27))) ...
      - 18 / (1 + exp(-0.35 * (t(k) - 64))) ...
      + 8 / (1 + exp(-0.28 * (t(k) - 88)))) * pi / 180;
    if k > 1
      idx = max(1, k - max(1, delay_steps));
      psi_meas(k) = psi(idx);
      err = psi_ref(k) - psi_meas(k);
      measured_rate = (psi_meas(k) - psi_meas(max(1, k - 1))) / dt;
      cmd(k) = clamp(kp * err - kd * measured_rate, -delta_max, delta_max);
      delta(k) = delta(k - 1) + dt / rudder_tau * (cmd(k) - delta(k - 1));
      r(k) = r(k - 1) + dt / yaw_tau * (yaw_gain * delta(k) - r(k - 1));
      psi(k) = psi(k - 1) + dt * r(k);
      x(k) = x(k - 1) + dt * v * cos(psi(k));
      y(k) = y(k - 1) + dt * v * sin(psi(k));
    endif
  endfor
  out = [t, psi_ref * 180 / pi, psi * 180 / pi, psi_meas * 180 / pi, x, y, cmd * 180 / pi, delta * 180 / pi];
endfunction

function row = planning_scenario(kind)
  dt = 0.08;
  t = (0:dt:80)';
  n = length(t);
  s = t / max(t);
  x = 360 * s;
  y = zeros(n, 1);
  if kind == 1
    for k = 1:n
      if t(k) < 18
        y(k) = 0;
      elseif t(k) < 30
        y(k) = (t(k) - 18) / 12 * 30;
      elseif t(k) < 46
        y(k) = 30;
      elseif t(k) < 58
        y(k) = 30 - (t(k) - 46) / 12 * 54;
      elseif t(k) < 70
        y(k) = -24 + (t(k) - 58) / 12 * 33;
      else
        y(k) = 9;
      endif
    endfor
  elseif kind == 2
    y = 14 * sin(2 * pi * 4.2 * s) .* (s > 0.18) .* (s < 0.88);
  else
    y = 28 ./ (1 + exp(-18 * (s - 0.42))) - 22 ./ (1 + exp(-18 * (s - 0.70)));
  endif
  dx = gradient(x, dt);
  dy = gradient(y, dt);
  psi_ref = atan2(dy, dx);
  psi = zeros(n, 1);
  u = zeros(n, 1);
  delta = zeros(n, 1);
  for k = 2:n
    err = wrap_pi(psi_ref(k) - psi(k - 1));
    u(k) = 3.4 * err + 0.35 * (psi_ref(k) - psi_ref(k - 1)) / dt;
    if kind == 1
      u(k) = u(k) + 1.8 * psi_ref(k);
    endif
    if kind == 2
      u(k) = u(k) + 0.18 * sin(2 * pi * 0.75 * t(k));
    endif
    target = clamp(u(k), -30 * pi / 180, 30 * pi / 180);
    delta(k) = rate_limit(delta(k - 1), target, 42 * pi / 180, dt);
    psi(k) = psi(k - 1) + dt * clamp(0.11 * delta(k), -0.055, 0.055);
  endfor
  row = [t, x, y, psi_ref * 180 / pi, u * 180 / pi, delta * 180 / pi];
endfunction

function out = simulate_actuator_response(mode)
  dt = 0.04;
  t = (0:dt:80)';
  n = length(t);
  ref = 72 * pi / 180 * ones(n, 1);
  psi = zeros(n, 1);
  r = zeros(n, 1);
  u_raw = zeros(n, 1);
  u_sat = zeros(n, 1);
  u_rate = zeros(n, 1);
  x = zeros(n, 1);
  y = zeros(n, 1);
  v = 3.0;
  prev_err = 0;
  delta_max = 16 * pi / 180;
  delta_rate = 5 * pi / 180;
  for k = 2:n
    err = wrap_pi(ref(k) - psi(k - 1));
    derr = (err - prev_err) / dt;
    raw = 3.1 * err + 0.18 * derr;
    sat = clamp(raw, -delta_max, delta_max);
    if mode == 1
      delta = raw;
    elseif mode == 2
      delta = sat;
    else
      delta = rate_limit(u_rate(k - 1), sat, delta_rate, dt);
    endif
    u_raw(k) = raw;
    u_sat(k) = sat;
    if mode == 3
      u_rate(k) = delta;
    else
      u_rate(k) = rate_limit(u_rate(k - 1), sat, delta_rate, dt);
    endif
    r(k) = r(k - 1) + dt / 7.5 * (0.42 * delta - r(k - 1));
    psi(k) = psi(k - 1) + dt * r(k);
    x(k) = x(k - 1) + dt * v * cos(psi(k));
    y(k) = y(k - 1) + dt * v * sin(psi(k));
    prev_err = err;
  endfor
  out = [t, u_raw * 180 / pi, u_sat * 180 / pi, u_rate * 180 / pi, ref * 180 / pi, psi * 180 / pi, x, y];
endfunction

function out = simulate_turning_radius(R)
  dt = 0.06;
  t = (0:dt:78)';
  n = length(t);
  v = 4.0;
  delta_max = 18 * pi / 180;
  L = 34.0;
  delta_needed = atan(L / R);
  delta_cmd = zeros(n, 1);
  psi = zeros(n, 1);
  x = zeros(n, 1);
  y = zeros(n, 1);
  for k = 2:n
    gate = 1 / (1 + exp(-0.85 * (t(k) - 5))) - 1 / (1 + exp(-0.55 * (t(k) - 49)));
    target = clamp(delta_needed * gate, -delta_max, delta_max);
    delta_cmd(k) = rate_limit(delta_cmd(k - 1), target, 10 * pi / 180, dt);
    yaw_rate = v / L * tan(delta_cmd(k));
    psi(k) = psi(k - 1) + dt * yaw_rate;
    x(k) = x(k - 1) + dt * v * cos(psi(k));
    y(k) = y(k - 1) + dt * v * sin(psi(k));
  endfor
  out = [t, delta_cmd * 180 / pi, psi * 180 / pi, x, y, R * ones(n, 1), delta_needed * 180 / pi * ones(n, 1)];
endfunction

write_table(fullfile(data_dir, "sensor_no_filter.csv"), "t,r,y,ym,yf,feedback,e,u,delta", simulate_sensor_case(false));
write_table(fullfile(data_dir, "sensor_with_filter.csv"), "t,r,y,ym,yf,feedback,e,u,delta", simulate_sensor_case(true));
write_table(fullfile(data_dir, "delay_ideal.csv"), "t,psi_ref,psi,psi_meas,x,y,cmd,delta", simulate_delay_case(0));
write_table(fullfile(data_dir, "delay_measured.csv"), "t,psi_ref,psi,psi_meas,x,y,cmd,delta", simulate_delay_case(2.8));
write_table(fullfile(data_dir, "planning_shortest.csv"), "t,x,y,psi_ref,u,delta", planning_scenario(1));
write_table(fullfile(data_dir, "planning_replan.csv"), "t,x,y,psi_ref,u,delta", planning_scenario(2));
write_table(fullfile(data_dir, "planning_feasible.csv"), "t,x,y,psi_ref,u,delta", planning_scenario(3));
write_table(fullfile(data_dir, "actuator_raw.csv"), "t,u_raw,u_sat,u_rate,ref,psi,x,y", simulate_actuator_response(1));
write_table(fullfile(data_dir, "actuator_sat.csv"), "t,u_raw,u_sat,u_rate,ref,psi,x,y", simulate_actuator_response(2));
write_table(fullfile(data_dir, "actuator_rate.csv"), "t,u_raw,u_sat,u_rate,ref,psi,x,y", simulate_actuator_response(3));
write_table(fullfile(data_dir, "turn_R35.csv"), "t,delta,psi,x,y,R,delta_needed", simulate_turning_radius(35));
write_table(fullfile(data_dir, "turn_R65.csv"), "t,delta,psi,x,y,R,delta_needed", simulate_turning_radius(65));
write_table(fullfile(data_dir, "turn_R140.csv"), "t,delta,psi,x,y,R,delta_needed", simulate_turning_radius(140));
