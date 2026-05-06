% Generate fixed-seed cold-chain benchmark data for unit 5-6.
% Octave owns the numerical truth; Python only renders the figures.

clear all;
rand("seed", 5606);
randn("seed", 5606);

lesson_dir = fileparts(fileparts(mfilename("fullpath")));
out_dir = fullfile(lesson_dir, "processed");
if exist(out_dir, "dir") != 7
  mkdir(out_dir);
endif

dt_min = 1.0;
minutes = (0:dt_min:(48 * 60))';
n = numel(minutes);

function v = clamp(x, lo, hi)
  v = min(max(x, lo), hi);
endfunction

function [door, load_heat, tamb, capacity, sensor_bias, scenario_label] = scenario_inputs(minutes, scenario)
  n = numel(minutes);
  hour = minutes / 60.0;
  tamb = 21.5 + 4.0 * sin(2 * pi * (hour - 7) / 24.0);
  tamb += 0.35 * randn(n, 1);
  door = zeros(n, 1);
  load_heat = zeros(n, 1);
  capacity = ones(n, 1);
  sensor_bias = zeros(n, 1);

  if strcmp(scenario, "E1")
    scenario_label = "E1 常规日";
    starts = [130, 365, 620, 930, 1190, 1520, 2050, 2510];
    for s = starts
      door(s:min(s + 4, n)) += 1.0;
    endfor
  elseif strcmp(scenario, "E2")
    scenario_label = "E2 入库高峰";
    starts = [510, 535, 562, 591, 625, 653, 681, 710, 1525, 1560, 1602, 1640];
    for s = starts
      door(s:min(s + 10, n)) += 1.0;
    endfor
    load_heat(520:760) += linspace(0.25, 1.45, 241)';
    load_heat(761:1020) += linspace(1.45, 0.20, 260)';
    load_heat(1530:1710) += 0.72;
  else
    scenario_label = "E3 未见扰动";
    starts = [460, 498, 532, 1210, 1255, 1990, 2045, 2110];
    for s = starts
      door(s:min(s + 11, n)) += 1.0;
    endfor
    door(900:2881) += 0.26;          % door seal degradation
    load_heat(470:650) += 1.05;
    load_heat(1220:1380) += 0.72;
    capacity(1320:2881) = 0.62;      % cooling capacity degradation
    sensor_bias(1500:2881) = -0.78;  % measured air temperature is biased low
  endif
endfunction

function forecast = heat_forecast(door, load_heat, tamb, k, horizon)
  last = min(numel(door), k + horizon);
  future_door = sum(door(k:last));
  future_load = sum(load_heat(k:last));
  future_amb = max(0, mean(tamb(k:last)) - 22);
  forecast = 0.16 * future_door + 0.09 * future_load + 0.35 * future_amb;
endfunction

function [Ta, Tp, u, mode] = simulate_route(minutes, door, load_heat, tamb, capacity, sensor_bias, method)
  n = numel(minutes);
  Ta = zeros(n, 1);
  Tp = zeros(n, 1);
  u = zeros(n, 1);
  mode = zeros(n, 1);
  Ta(1) = 5.15;
  Tp(1) = 5.05;
  integ = 0.0;
  prev_error = 0.0;

  for k = 1:n-1
    measured = Ta(k) + sensor_bias(k);
    predicted_heat = heat_forecast(door, load_heat, tamb, k, 60);
    setpoint = 5.0;
    kp = 0.42;
    ki = 0.010;
    kd = 0.08;
    feedforward = 0.0;
    mode(k) = 2; % normal

    if strcmp(method, "data")
      if predicted_heat > 7.8
        setpoint = 4.25;
        mode(k) = 1; % precool
      endif
      feedforward = clamp(0.030 * predicted_heat + 0.020 * max(0, tamb(k) - 23), 0, 0.52);
      kp = 0.48;
      ki = 0.011;
      kd = 0.08;
    elseif strcmp(method, "policy")
      if measured > 6.7 || Tp(k) > 6.3
        setpoint = 4.1;
        kp = 0.58;
        ki = 0.014;
        kd = 0.10;
        feedforward = 0.22;
        mode(k) = 4; % conservative recovery
      elseif predicted_heat > 9.0
        setpoint = 4.35;
        kp = 0.52;
        ki = 0.012;
        feedforward = 0.24;
        mode(k) = 1; % precool
      elseif predicted_heat < 1.2 && measured < 5.2 && Tp(k) < 5.25
        setpoint = 5.65;
        kp = 0.34;
        ki = 0.006;
        mode(k) = 3; % energy saving
      endif
      if sensor_bias(k) < -0.2
        % Training did not include biased sensors: the supervisor trusts the biased measurement.
        feedforward *= 0.78;
      endif
    endif

    error = measured - setpoint;
    deriv = error - prev_error;
    candidate = kp * error + integ + kd * deriv + feedforward;
    uk = clamp(candidate, 0.0, 1.0);
    if (candidate > 0 && candidate < 1) || (candidate <= 0 && error > 0) || (candidate >= 1 && error < 0)
      integ += ki * error;
      integ = clamp(integ, -0.35, 0.70);
    endif
    prev_error = error;
    u(k) = uk;

    env_gain = (tamb(k) - Ta(k)) / 420.0;
    product_air = (Tp(k) - Ta(k)) / 92.0;
    door_gain = 0.040 * door(k);
    load_gain_air = 0.030 * load_heat(k);
    cooling = 0.080 * capacity(k) * uk;
    Ta(k + 1) = Ta(k) + env_gain + product_air + door_gain + load_gain_air - cooling;
    Tp(k + 1) = Tp(k) + (Ta(k) - Tp(k)) / 250.0 + 0.0062 * load_heat(k);
  endfor
  u(n) = u(n - 1);
  mode(n) = mode(n - 1);
endfunction

function write_trace(path, minutes, Ta, Tp, u, door, load_heat, tamb, mode)
  fid = fopen(path, "w");
  fprintf(fid, "minute,air_C,product_C,compressor_duty,door_heat,load_heat,ambient_C,mode\n");
  for i = 1:numel(minutes)
    fprintf(fid, "%.0f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%d\n", minutes(i), Ta(i), Tp(i), u(i), door(i), load_heat(i), tamb(i), mode(i));
  endfor
  fclose(fid);
endfunction

function [out_minutes, max_air, max_product, recovery, energy, switches, alarms] = metrics_for(minutes, Ta, Tp, u, door, load_heat)
  out_mask = (Ta < 2.0) | (Ta > 8.0) | (Tp < 2.0) | (Tp > 8.0);
  out_minutes = sum(out_mask);
  max_air = max(Ta);
  max_product = max(Tp);
  hot_event = find((door > 0.05) | (load_heat > 0.05));
  if isempty(hot_event)
    recovery = 0;
  else
    last_event = hot_event(end);
    recovered = find(minutes >= minutes(last_event) & Ta <= 5.8 & Tp <= 5.8);
    if isempty(recovered)
      recovery = minutes(end) - minutes(last_event);
    else
      recovery = max(0, minutes(recovered(1)) - minutes(last_event));
    endif
  endif
  energy = sum(u) / 60.0;
  on_state = u > 0.80;
  switches = sum(abs(diff(on_state)) > 0);
  alarm_edges = diff([0; out_mask; 0]);
  alarms = sum(alarm_edges == 1);
endfunction

scenarios = {"E1", "E2", "E3"};
methods = {"classic", "data", "policy"};
method_labels = struct("classic", "经典 PI/PID", "data", "数据驱动预测补偿", "policy", "策略学习监督层");
verify_load = struct("classic", "低", "data", "中", "policy", "高");

summary_path = fullfile(out_dir, "5-6-cold-chain-summary.csv");
fid_sum = fopen(summary_path, "w");
fprintf(fid_sum, "scenario,scenario_label,method,method_label,out_of_range_min,max_air_C,max_product_C,recovery_min,energy_norm_h,compressor_switches,alarms,verify_load\n");

model_path = fullfile(out_dir, "5-6-cold-chain-model-params.csv");
fid_model = fopen(model_path, "w");
fprintf(fid_model, "parameter,value,unit,note\n");
fprintf(fid_model, "dt,1,min,sampling period\n");
fprintf(fid_model, "T_set,5,C,nominal setpoint\n");
fprintf(fid_model, "T_low,2,C,storage lower bound\n");
fprintf(fid_model, "T_high,8,C,storage upper bound\n");
fprintf(fid_model, "tau_ambient,420,min,air to ambient thermal time\n");
fprintf(fid_model, "tau_air_product,92,min,air to product core exchange\n");
fprintf(fid_model, "tau_product,250,min,product core inertia\n");
fprintf(fid_model, "cooling_gain,0.080,C_per_min,max compressor cooling coefficient\n");
fclose(fid_model);

config_path = fullfile(out_dir, "5-6-route-implementation-config.csv");
fid_cfg = fopen(config_path, "w");
fprintf(fid_cfg, "route,item,value,note\n");
fprintf(fid_cfg, "classic,T_set,5.00,nominal air-temperature setpoint in C\n");
fprintf(fid_cfg, "classic,Kp,0.42,proportional gain applied to measured air-temperature error\n");
fprintf(fid_cfg, "classic,Ki,0.010,integral increment per minute with anti-windup\n");
fprintf(fid_cfg, "classic,Kd,0.08,one-step difference damping term\n");
fprintf(fid_cfg, "classic,I_min,-0.35,integral lower clamp\n");
fprintf(fid_cfg, "classic,I_max,0.70,integral upper clamp\n");
fprintf(fid_cfg, "data,forecast_horizon,60,minutes of future door/load/ambient signals summarized\n");
fprintf(fid_cfg, "data,forecast_formula,0.16*sum(qdoor)+0.09*sum(qload)+0.35*max(0,mean(Tamb)-22),dimensionless heat-load score\n");
fprintf(fid_cfg, "data,parameter_source,E1_E2_offline_calibration,transparent linear weights calibrated on normal and receiving-peak development logs\n");
fprintf(fid_cfg, "data,input_qdoor,door switch logs or receiving work plan,simulated as minute-level door heat load\n");
fprintf(fid_cfg, "data,input_qload,batch receiving records and product initial heat,simulated as receiving heat-load profile\n");
fprintf(fid_cfg, "data,input_Tamb,ambient sensor and short-term forecast,simulated as 60-minute mean ambient temperature\n");
fprintf(fid_cfg, "data,precool_threshold,7.8,forecast score triggering precooling\n");
fprintf(fid_cfg, "data,precool_setpoint,4.25,air-temperature setpoint in C during predicted load\n");
fprintf(fid_cfg, "data,feedforward_formula,clip(0.030*forecast+0.020*max(0,Tamb-23),0,0.52),compressor-duty feedforward term\n");
fprintf(fid_cfg, "data,Kp_Ki_Kd,0.48/0.011/0.08,PID gains after adding prediction compensation\n");
fprintf(fid_cfg, "policy,state_vector,T_measured/T_product/forecast/T_ambient,observable supervisor inputs used by threshold policy\n");
fprintf(fid_cfg, "policy,hidden_fault_sensor_bias,sensor_bias,simulation-only hidden fault used for E3 evaluation and not available to supervisor\n");
fprintf(fid_cfg, "policy,training_scope,E1_and_E2_only,thresholds are calibrated on normal and receiving-peak scenarios\n");
fprintf(fid_cfg, "policy,held_out_scope,E3,door-seal degradation sensor bias and cooling-capacity loss are not used for calibration\n");
fprintf(fid_cfg, "policy,conservative_recovery,if T_measured>6.7 or T_product>6.3 then T_set=4.10 Kp=0.58 Ki=0.014 Kd=0.10 uff=0.22,mode 4\n");
fprintf(fid_cfg, "policy,precool,else if forecast>9.0 then T_set=4.35 Kp=0.52 Ki=0.012 uff=0.24,mode 1\n");
fprintf(fid_cfg, "policy,energy_saving,else if forecast<1.2 and T_measured<5.2 and T_product<5.25 then T_set=5.65 Kp=0.34 Ki=0.006,mode 3\n");
fprintf(fid_cfg, "policy,normal,otherwise use classic PID settings,mode 2\n");
fprintf(fid_cfg, "policy,bias_gap,if sensor_bias<-0.2 feedforward is multiplied by 0.78,models an uncovered biased-sensor case\n");
fclose(fid_cfg);

for sidx = 1:numel(scenarios)
  scenario = scenarios{sidx};
  [door, load_heat, tamb, capacity, sensor_bias, scenario_label] = scenario_inputs(minutes, scenario);
  event_path = fullfile(out_dir, sprintf("5-6-%s-event-log.csv", scenario));
  fid_event = fopen(event_path, "w");
  fprintf(fid_event, "minute,door_heat,load_heat,ambient_C,capacity,sensor_bias_C\n");
  for i = 1:n
    fprintf(fid_event, "%.0f,%.5f,%.5f,%.5f,%.5f,%.5f\n", minutes(i), door(i), load_heat(i), tamb(i), capacity(i), sensor_bias(i));
  endfor
  fclose(fid_event);

  for midx = 1:numel(methods)
    method = methods{midx};
    [Ta, Tp, u, mode] = simulate_route(minutes, door, load_heat, tamb, capacity, sensor_bias, method);
    write_trace(fullfile(out_dir, sprintf("5-6-%s-%s-trace.csv", scenario, method)), minutes, Ta, Tp, u, door, load_heat, tamb, mode);
    [out_minutes, max_air, max_product, recovery, energy, switches, alarms] = metrics_for(minutes, Ta, Tp, u, door, load_heat);
    fprintf(fid_sum, "%s,%s,%s,%s,%d,%.2f,%.2f,%.0f,%.2f,%d,%d,%s\n", scenario, scenario_label, method, method_labels.(method), out_minutes, max_air, max_product, recovery, energy, switches, alarms, verify_load.(method));
  endfor
endfor

fclose(fid_sum);
printf("Generated 5-6 cold-chain benchmark data in %s\n", out_dir);
