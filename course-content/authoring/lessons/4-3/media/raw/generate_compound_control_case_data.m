pkg load control;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "4-3-compound-control-case-data.json");

if exist(out_dir, "dir") ~= 7
  mkdir(out_dir);
endif

function out = response_to_struct(t, y)
  out = struct();
  out.t = t(:)';
  out.y = y(:)';
endfunction

function y = sat(x, lo, hi)
  y = min(max(x, lo), hi);
endfunction

function [y, u] = linear_two_input_response(T_r, T_d, U_r, U_d, t, r, d)
  y = lsim(T_r, r, t) + lsim(T_d, d, t);
  u = lsim(U_r, r, t) + lsim(U_d, d, t);
endfunction

function out = make_compare_payload(t, r, d, y_before, u_before, y_after, u_after)
  out = struct();
  out.reference = response_to_struct(t, r);
  out.disturbance = response_to_struct(t, d);
  out.before_y = response_to_struct(t, y_before);
  out.before_u = response_to_struct(t, u_before);
  out.after_y = response_to_struct(t, y_after);
  out.after_u = response_to_struct(t, u_after);
endfunction

function out = add_full_strength(out, t, y_full, u_full)
  out.full_y = response_to_struct(t, y_full);
  out.full_u = response_to_struct(t, u_full);
endfunction

function out = simulate_aw(use_aw, t, r, d, params)
  n = numel(t);
  dt = t(2) - t(1);
  x = zeros(3, 1);
  xi = 0;
  rf = 0;
  qd = 0;
  qr = 0;
  u_prev = 0;
  y = zeros(n, 1);
  u = zeros(n, 1);
  u_raw_hist = zeros(n, 1);
  rf_hist = zeros(n, 1);

  for k = 1:n
    y(k) = x(1);
    rf_hist(k) = rf;
    e = rf - x(1);
    u_fd = params.fd_gain * qd;
    u_fr = params.fr_gain * (r(k) - qr) / params.tr;
    u_ff = u_fd + u_fr;
    u_raw = params.kp * e + params.ki * xi - params.kd * x(2) + u_ff;
    u_sat = sat(u_raw, params.umin, params.umax);
    du = sat(u_sat - u_prev, -params.rate * dt, params.rate * dt);
    u_act = u_prev + du;
    u(k) = u_act;
    u_raw_hist(k) = u_raw;

    if use_aw
      xi_dot = e + (u_act - u_raw) / params.taw;
    else
      xi_dot = e;
    endif
    xi = xi + dt * xi_dot;
    rf = rf + dt * (r(k) - rf) / params.tf;
    qd = qd + dt * (d(k) - qd) / params.td;
    qr = qr + dt * (r(k) - qr) / params.tr;

    xdot = [
      x(2);
      -0.1 * x(2) + x(3) + d(k);
      -2.14375 * x(3) + 0.01715 * u_act
    ];
    x = x + dt * xdot;
    u_prev = u_act;
  endfor

  out = struct();
  out.y = y(:)';
  out.u = u(:)';
  out.u_raw = u_raw_hist(:)';
  out.r_filtered = rf_hist(:)';
endfunction

s = tf("s");
Ga = 0.01715 / (s + 2.14375);
Gp = 1 / (s * (s + 0.1));
Gu = Ga * Gp;
Gd = Gp;

Kc = 1.338;
alpha = 0.427;
T_lead = 13.91;
beta = 1.8;
wz_lag = 0.00917;
T_lag = 1 / wz_lag;
C_lead = (T_lead * s + 1) / (alpha * T_lead * s + 1);
C_lag = beta * (T_lag * s + 1) / (beta * T_lag * s + 1);
Cb = Kc * C_lead * C_lag;

lambda_d = 0.75;
Td_filter = 8;
Fd_ideal_gain = -1 / 0.01715;
Fd = lambda_d * Fd_ideal_gain * (s + 2.14375) / (Td_filter * s + 1);
Fd_full = Fd_ideal_gain * (s + 2.14375) / (Td_filter * s + 1);

lambda_r = 0.75;
Tr_ff_filter = 8;
Fr = lambda_r * 12.5 * s / (Tr_ff_filter * s + 1);
Fr_full = 12.5 * s / (Tr_ff_filter * s + 1);

Tf_setpoint = 16;
Qf = 1 / (Tf_setpoint * s + 1);

den = 1 + Gu * Cb;

t = (0:0.2:220)';
r_step = ones(size(t));
r_disturbance = zeros(size(t));
d_common = 0.004 + 0.003 * sin(0.08 * t);

Tr_base = Gu * Cb / den;
Td_no = Gd / den;
Ur_base = Cb - Cb * Tr_base;
Ud_no = -Cb * Td_no;
Td_ff = (Gu * Fd + Gd) / den;
Ud_ff = Fd - Cb * Td_ff;
Td_ff_full = (Gu * Fd_full + Gd) / den;
Ud_ff_full = Fd_full - Cb * Td_ff_full;

[y_no_dff, u_no_dff] = linear_two_input_response(Tr_base, Td_no, Ur_base, Ud_no, t, r_disturbance, d_common);
[y_dff, u_dff] = linear_two_input_response(Tr_base, Td_ff, Ur_base, Ud_ff, t, r_disturbance, d_common);
[y_dff_full, u_dff_full] = linear_two_input_response(Tr_base, Td_ff_full, Ur_base, Ud_ff_full, t, r_disturbance, d_common);

r_move = 0.5 * (1 - cos(pi * min(t / 80, 1)));
Tr_no_rff = Tr_base;
Ur_no_rff = Ur_base;
Tr_rff = Gu * (Cb + Fr) / den;
Ur_rff = Cb + Fr - Cb * Tr_rff;
Tr_rff_full = Gu * (Cb + Fr_full) / den;
Ur_rff_full = Cb + Fr_full - Cb * Tr_rff_full;
[y_no_rff, u_no_rff] = linear_two_input_response(Tr_no_rff, Td_ff, Ur_no_rff, Ud_ff, t, r_move, d_common);
[y_rff, u_rff] = linear_two_input_response(Tr_rff, Td_ff, Ur_rff, Ud_ff, t, r_move, d_common);
[y_rff_full, u_rff_full] = linear_two_input_response(Tr_rff_full, Td_ff, Ur_rff_full, Ud_ff, t, r_move, d_common);

r_sharp = double(t >= 20);
Tr_no_filter = Tr_rff;
Ur_no_filter = Ur_rff;
Tr_setpoint_filter = Gu * (Cb * Qf + Fr) / den;
Ur_setpoint_filter = Cb * Qf + Fr - Cb * Tr_setpoint_filter;
[y_no_filter, u_no_filter] = linear_two_input_response(Tr_no_filter, Td_ff, Ur_no_filter, Ud_ff, t, r_sharp, d_common);
[y_filter, u_filter] = linear_two_input_response(Tr_setpoint_filter, Td_ff, Ur_setpoint_filter, Ud_ff, t, r_sharp, d_common);

t_aw = (0:0.1:280)';
r_aw = 3.0 * double(t_aw >= 20);
d_aw = 0.006 + 0.003 * sin(0.07 * t_aw);
aw_params = struct(
  "kp", 8.0,
  "ki", 0.12,
  "kd", 32.0,
  "tf", 14.0,
  "fd_gain", lambda_d * Fd_ideal_gain,
  "td", Td_filter,
  "fr_gain", lambda_r * 12.5,
  "tr", Tr_ff_filter,
  "umin", -2.4,
  "umax", 2.4,
  "rate", 0.045,
  "taw", 1.8
);
no_aw = simulate_aw(false, t_aw, r_aw, d_aw, aw_params);
with_aw = simulate_aw(true, t_aw, r_aw, d_aw, aw_params);

payload = struct();
payload.parameters = struct(
  "actuator", "G_a(s)=0.01715/(s+2.14375)",
  "plant", "G_p(s)=1/[s(s+0.1)]",
  "control_path", "G_u(s)=G_a(s)G_p(s)=0.01715/[s(s+0.1)(s+2.14375)]",
  "disturbance_path", "G_d(s)=G_p(s)=1/[s(s+0.1)]",
  "feedback", "C_b(s)=1.338(13.91s+1)(109.05s+1)/[(5.94s+1)(196.29s+1)]",
  "disturbance_ff_ideal", "F_d^*(s)=-(s+2.14375)/0.01715",
  "disturbance_ff_practical", "F_d(s)=-43.73(s+2.14375)/(8s+1)",
  "reference_ff", "F_r(s)=9.375s/(8s+1)",
  "setpoint_filter", "Q_f(s)=1/(16s+1)",
  "antiwindup", "dot{x_i}=e+(u_act-u_raw)/1.8"
);
payload.disturbance_ff = make_compare_payload(t, r_disturbance, d_common, y_no_dff, u_no_dff, y_dff, u_dff);
payload.disturbance_ff = add_full_strength(payload.disturbance_ff, t, y_dff_full, u_dff_full);
payload.reference_ff = make_compare_payload(t, r_move, d_common, y_no_rff, u_no_rff, y_rff, u_rff);
payload.reference_ff = add_full_strength(payload.reference_ff, t, y_rff_full, u_rff_full);
payload.setpoint_filter = make_compare_payload(t, r_sharp, d_common, y_no_filter, u_no_filter, y_filter, u_filter);
payload.antiwindup = struct();
payload.antiwindup.reference = response_to_struct(t_aw, r_aw);
payload.antiwindup.disturbance = response_to_struct(t_aw, d_aw);
payload.antiwindup.before_y = response_to_struct(t_aw, no_aw.y');
payload.antiwindup.before_u = response_to_struct(t_aw, no_aw.u');
payload.antiwindup.before_u_raw = response_to_struct(t_aw, no_aw.u_raw');
payload.antiwindup.after_y = response_to_struct(t_aw, with_aw.y');
payload.antiwindup.after_u = response_to_struct(t_aw, with_aw.u');
payload.antiwindup.after_u_raw = response_to_struct(t_aw, with_aw.u_raw');

fid = fopen(out_file, "w");
if fid < 0
  error("Failed to open output file: %s", out_file);
endif
fwrite(fid, jsonencode(payload), "char");
fclose(fid);

printf("Wrote %s\n", out_file);
