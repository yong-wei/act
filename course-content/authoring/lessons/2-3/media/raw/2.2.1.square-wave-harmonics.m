t = linspace(0, 2*pi, 3000);
base = (4/pi) * sin(t);
three = (4/pi) * (sin(t) + sin(3*t)/3 + sin(5*t)/5);
seven = (4/pi) * (sin(t) + sin(3*t)/3 + sin(5*t)/5 + sin(7*t)/7 + sin(9*t)/9 + sin(11*t)/11);
filtered = 0.95 * sin(t) + 0.18 * (4/pi/3) * sin(3*t);

subplot(2,2,1); plot(t, base, 'LineWidth', 1.8); title('只保留基波'); grid on;
subplot(2,2,2); plot(t, three, 'LineWidth', 1.8); title('加入 3、5 次谐波'); grid on;
subplot(2,2,3); plot(t, seven, 'LineWidth', 1.8); title('加入更多高频谐波'); grid on;
subplot(2,2,4); plot(t, filtered, 'LineWidth', 1.8); title('系统压制高频后重构'); grid on;
