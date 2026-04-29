pkg load control;

outdir = fullfile(fileparts(mfilename("fullpath")), "..", "processed", "5-2-describing-function-data");
if exist(outdir, "dir") != 7
  mkdir(outdir);
endif

function y = satnl(x, k, a)
  y = k .* min(max(x, -a), a);
endfunction

function y = deadzone(x, k, d)
  y = k .* ((x > d) .* (x - d) + (x < -d) .* (x + d));
endfunction

function y = relaynl(x, M)
  y = M .* sign(x);
  y(x == 0) = 0;
endfunction

function y = dzrelay(x, M, d)
  y = M .* ((x > d) - (x < -d));
endfunction

function y = dzsat(x, k, d, a)
  y = k .* ((x > d) .* min(x - d, a - d) + (x < -d) .* max(x + d, -a + d));
endfunction

function N = N_sat(A, k, a)
  N = k .* ones(size(A));
  idx = find(A > a);
  r = a ./ A(idx);
  N(idx) = (2 * k / pi) .* (asin(r) + r .* sqrt(1 - r .^ 2));
endfunction

function N = N_deadzone(A, k, d)
  N = zeros(size(A));
  idx = find(A > d);
  r = d ./ A(idx);
  N(idx) = (2 * k / pi) .* (pi / 2 - asin(r) - r .* sqrt(1 - r .^ 2));
endfunction

function N = N_relay(A, M)
  N = 4 * M ./ (pi .* A);
endfunction

function N = N_dzrelay(A, M, d)
  N = zeros(size(A));
  idx = find(A > d);
  r = d ./ A(idx);
  N(idx) = (4 * M ./ (pi .* A(idx))) .* sqrt(1 - r .^ 2);
endfunction

function N = N_hystrelay(A, M, h)
  N = zeros(size(A));
  idx = find(A > h);
  r = h ./ A(idx);
  N(idx) = (4 * M ./ (pi .* A(idx))) .* (sqrt(1 - r .^ 2) - 1i .* r);
endfunction

function N = N_backlash(A, k, b)
  N = zeros(size(A));
  idx = find(A > b);
  r = b ./ A(idx);
  real_part = (k / pi) .* (pi / 2 + asin(1 - 2 .* r) + 2 .* (1 - 2 .* r) .* sqrt(r .* (1 - r)));
  imag_part = (4 * k .* b ./ (pi .* A(idx))) .* (r - 1);
  N(idx) = real_part + 1i .* imag_part;
endfunction

function N = N_dzsat(A, k, d, a)
  N = zeros(size(A));
  mid = find(A > d & A <= a);
  r = d ./ A(mid);
  N(mid) = (2 * k / pi) .* (pi / 2 - asin(r) - r .* sqrt(1 - r .^ 2));
  high = find(A > a);
  rd = d ./ A(high);
  ra = a ./ A(high);
  N(high) = (2 * k / pi) .* (asin(ra) - asin(rd) + ra .* sqrt(1 - ra .^ 2) - rd .* sqrt(1 - rd .^ 2));
endfunction

function write_complex_curve(path, A, N)
  valid = find(abs(N) > 1e-12);
  Z = -1 ./ N(valid);
  csvwrite(path, [A(valid), real(Z), imag(Z), real(N(valid)), imag(N(valid))]);
endfunction

function y = pulse_input(t, amp, width)
  y = amp .* (t <= width);
endfunction

function xnext = rk4_step(fun, t, x, dt)
  k1 = fun(t, x);
  k2 = fun(t + dt / 2, x + dt * k1 / 2);
  k3 = fun(t + dt / 2, x + dt * k2 / 2);
  k4 = fun(t + dt, x + dt * k3);
  xnext = x + dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
endfunction

function u = relay_scalar(e, M)
  if e >= 0
    u = M;
  else
    u = -M;
  endif
endfunction

function u = sat_scalar(e, limit)
  u = min(max(e, -limit), limit);
endfunction

function u = dzsat_scalar(e, d, a, k)
  if e > d
    u = k * min(e - d, a - d);
  elseif e < -d
    u = k * max(e + d, -a + d);
  else
    u = 0;
  endif
endfunction

function sim = simulate_relay_pulse(Tend, dt, amp, width, M)
  n = floor(Tend / dt) + 1;
  sim = zeros(n, 5);
  x = [0; 0; 0];
  for ii = 1:n
    t = (ii - 1) * dt;
    r = pulse_input(t, amp, width);
    e = r - x(1);
    u = relay_scalar(e, M);
    sim(ii, :) = [t, r, e, u, x(1)];
    if ii < n
      f = @(tau, z) [z(2); z(3); 10 * relay_scalar(pulse_input(tau, amp, width) - z(1), M) - 4 * z(3) - 4 * z(2)];
      x = rk4_step(f, t, x, dt);
    endif
  endfor
endfunction

function sim = simulate_sat_pulse(K, Tend, dt, amp, width)
  n = floor(Tend / dt) + 1;
  sim = zeros(n, 5);
  x = [0; 0; 0];
  for ii = 1:n
    t = (ii - 1) * dt;
    r = pulse_input(t, amp, width);
    e = r - x(1);
    u = sat_scalar(e, 1);
    sim(ii, :) = [t, r, e, u, x(1)];
    if ii < n
      f = @(tau, z) [z(2); z(3); 5 * K * sat_scalar(pulse_input(tau, amp, width) - z(1), 1) - 6 * z(3) - 5 * z(2)];
      x = rk4_step(f, t, x, dt);
    endif
  endfor
endfunction

function sim = simulate_dzsat_pulse(K, d, a, Tend, dt, amp, width)
  n = floor(Tend / dt) + 1;
  sim = zeros(n, 5);
  x = [0; 0; 0];
  for ii = 1:n
    t = (ii - 1) * dt;
    r = pulse_input(t, amp, width);
    e = r - x(1);
    u = dzsat_scalar(e, d, a, 1);
    sim(ii, :) = [t, r, e, u, x(1)];
    if ii < n
      f = @(tau, z) [z(2); z(3); 5 * K * dzsat_scalar(pulse_input(tau, amp, width) - z(1), d, a, 1) - 6 * z(3) - 5 * z(2)];
      x = rk4_step(f, t, x, dt);
    endif
  endfor
endfunction

% Static input-output relationships.
x = linspace(-2.2, 2.2, 801)';
static = [x, satnl(x, 1, 1), deadzone(x, 1, 0.55), relaynl(x, 1), dzrelay(x, 1, 0.55), dzsat(x, 1, 0.35, 1.35)];
csvwrite(fullfile(outdir, "static_memoryless.csv"), static);

% Hysteresis relay loop and backlash loop as path data.
h = 0.45; M = 1;
hyst = [-1.8 -M; -h -M; -h M; 1.8 M; h M; h -M; -1.8 -M];
csvwrite(fullfile(outdir, "static_hysteresis_relay.csv"), hyst);

b = 0.45; k = 1;
backlash = [-1.8 -1.35; -b -1.35; 1.35 0.45; 1.8 0.9; b 0.9; -1.35 -0.9; -1.8 -1.35];
csvwrite(fullfile(outdir, "static_backlash.csv"), backlash);

% Negative inverse describing function curves.
A = linspace(0.05, 8, 1000)';
write_complex_curve(fullfile(outdir, "inv_saturation.csv"), A, N_sat(A, 1, 1));
write_complex_curve(fullfile(outdir, "inv_deadzone.csv"), A, N_deadzone(A, 1, 0.55));
write_complex_curve(fullfile(outdir, "inv_relay.csv"), A, N_relay(A, 1));
write_complex_curve(fullfile(outdir, "inv_deadzone_relay.csv"), A, N_dzrelay(A, 1, 0.55));
write_complex_curve(fullfile(outdir, "inv_hysteresis_relay.csv"), A, N_hystrelay(A, 1, 0.45));
write_complex_curve(fullfile(outdir, "inv_backlash.csv"), A, N_backlash(A, 1, 0.45));
write_complex_curve(fullfile(outdir, "inv_deadzone_saturation.csv"), A, N_dzsat(A, 1, 0.35, 1.35));

% Parameter-effect families.
for kk = [0.7, 1.0, 1.4]
  write_complex_curve(fullfile(outdir, sprintf("family_sat_k_%.1f.csv", kk)), A, N_sat(A, kk, 1));
endfor
for dd = [0.35, 0.65, 1.0]
  write_complex_curve(fullfile(outdir, sprintf("family_deadzone_d_%.2f.csv", dd)), A, N_deadzone(A, 1, dd));
endfor
for hh = [0.25, 0.55, 0.9]
  write_complex_curve(fullfile(outdir, sprintf("family_hysteresis_h_%.2f.csv", hh)), A, N_hystrelay(A, 1, hh));
endfor
for bb = [0.25, 0.55, 0.9]
  write_complex_curve(fullfile(outdir, sprintf("family_backlash_b_%.2f.csv", bb)), A, N_backlash(A, 1, bb));
endfor

% Small-perturbation figure: I-type third-order Nyquist curve.
w_sp = logspace(-3, 3, 4000)';
s_sp = 1i .* w_sp;
G_sp = 2 ./ (s_sp .* (s_sp + 1) .* (0.15 .* s_sp + 1));
csvwrite(fullfile(outdir, "small_perturbation_nyquist.csv"), [w_sp, real(G_sp), imag(G_sp)]);

% Example 1: ideal relay with G(s)=10/[s(s+2)^2].
w = logspace(-2, 2, 1000)';
s = 1i .* w;
G1 = 10 ./ (s .* (s + 2) .^ 2);
csvwrite(fullfile(outdir, "example_relay_nyquist.csv"), [w, real(G1), imag(G1)]);
A1 = linspace(0.05, 3.0, 600)';
write_complex_curve(fullfile(outdir, "example_relay_inv.csv"), A1, N_relay(A1, 1));
relay_point = [2, -0.625, 0, 2.5 / pi];
csvwrite(fullfile(outdir, "example_relay_point.csv"), relay_point);
csvwrite(fullfile(outdir, "example_relay_sim.csv"), simulate_relay_pulse(35, 0.002, 0.8, 0.08, 1));

% Example 2: saturation with G(s)=K/[s(s+1)(0.2s+1)].
G4 = 4 ./ (s .* (s + 1) .* (0.2 .* s + 1));
G9 = 9 ./ (s .* (s + 1) .* (0.2 .* s + 1));
csvwrite(fullfile(outdir, "example_saturation_nyquist.csv"), [w, real(G4), imag(G4), real(G9), imag(G9)]);
A2 = linspace(1.0, 5.0, 600)';
write_complex_curve(fullfile(outdir, "example_saturation_inv.csv"), A2, N_sat(A2, 1, 1));
sat_point = [sqrt(5), -1.5, 0, 1.8073615968];
csvwrite(fullfile(outdir, "example_saturation_point.csv"), sat_point);

csvwrite(fullfile(outdir, "example_saturation_sim_k4.csv"), simulate_sat_pulse(4, 45, 0.002, 2.0, 0.5));
csvwrite(fullfile(outdir, "example_saturation_sim_k9.csv"), simulate_sat_pulse(9, 45, 0.002, 2.0, 0.5));

% Case: normalized ship rudder actuator with dead-zone saturation.
case_d = 0.30;
case_a = 1.00;
case_K_bad = 10;
case_K_ok = 5;
G_case_bad = case_K_bad ./ (s .* (s + 1) .* (0.2 .* s + 1));
G_case_ok = case_K_ok ./ (s .* (s + 1) .* (0.2 .* s + 1));
csvwrite(fullfile(outdir, "case_ship_nyquist.csv"), [w, real(G_case_ok), imag(G_case_ok), real(G_case_bad), imag(G_case_bad)]);
A_case = linspace(case_d + 0.001, 5.0, 1000)';
N_case = N_dzsat(A_case, 1, case_d, case_a);
write_complex_curve(fullfile(outdir, "case_ship_dzsat_inv.csv"), A_case, N_case);
[~, idx_case] = min(abs(N_case - 6 / case_K_bad));
case_point = [sqrt(5), -case_K_bad / 6, 0, A_case(idx_case), N_case(idx_case)];
csvwrite(fullfile(outdir, "case_ship_point.csv"), case_point);
csvwrite(fullfile(outdir, "case_ship_sim_k5.csv"), simulate_dzsat_pulse(case_K_ok, case_d, case_a, 55, 0.002, 2.0, 0.5));
csvwrite(fullfile(outdir, "case_ship_sim_k10.csv"), simulate_dzsat_pulse(case_K_bad, case_d, case_a, 55, 0.002, 2.0, 0.5));
