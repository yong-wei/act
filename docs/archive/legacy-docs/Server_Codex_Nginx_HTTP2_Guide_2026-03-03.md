# act.adapt-learn.online 服务器侧配置指南（面向 Codex）

## 1. 目标
- 修复线上 `ERR_HTTP2_PROTOCOL_ERROR` 与 `Failed to fetch RSC payload` 间歇错误。
- 对大体积 `.glb` 资源增加缓存与稳定传输策略。
- 不影响 `adapt-learn.online` 现有默认站点。

## 2. 适用范围
- ECS: Alibaba Cloud Linux 3 / AMD64
- 反向代理: Nginx（证书已配置，站点为 `act.adapt-learn.online`）
- 应用容器: Podman，应用监听 `127.0.0.1:8083`

## 3. 请让服务器端 Codex 执行的步骤

### 步骤 A：确认现状
```bash
nginx -v
nginx -T | sed -n '/server_name act.adapt-learn.online/,/}/p'
curl -I --http2 https://act.adapt-learn.online/assets/luxury-liner.glb
```

### 步骤 B：更新该子域名 server 块
将 `act.adapt-learn.online` 的 server 配置替换/合并为以下内容（不要改其他域名 server）：

```nginx
server {
    listen 80;
    server_name act.adapt-learn.online;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name act.adapt-learn.online;

    # 证书路径按服务器现状保留
    ssl_certificate     /etc/letsencrypt/live/act.adapt-learn.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/act.adapt-learn.online/privkey.pem;

    # 基础稳定性参数
    client_max_body_size 50m;
    keepalive_timeout 65s;
    send_timeout 120s;

    # 大文件与 RSC 流稳定转发
    proxy_http_version 1.1;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 60s;
    proxy_buffering off;
    proxy_request_buffering off;

    # Next.js 主站请求
    location / {
        proxy_pass http://127.0.0.1:8083;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }

    # Next 静态资源长期缓存
    location /_next/static/ {
        proxy_pass http://127.0.0.1:8083;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # 船模资源缓存（关键）
    location ~* \.(glb|gltf)$ {
        proxy_pass http://127.0.0.1:8083;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        add_header Access-Control-Allow-Origin "*";
    }
}
```

若原配置未定义 `$connection_upgrade`，在 `http {}` 中补充：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

### 步骤 C：校验并重载
```bash
nginx -t
systemctl reload nginx
```

### 步骤 D：回归验证
```bash
curl -I --http2 https://act.adapt-learn.online/simulations/lng?_rsc=test -H 'RSC: 1'
curl -I --http2 https://act.adapt-learn.online/assets/Lng-carrier.glb
```

浏览器验证点：
- 首页与仿真页切换时，不再批量出现 `Failed to fetch RSC payload`
- `.glb` 请求状态稳定，控制台不再频繁出现 `ERR_HTTP2_PROTOCOL_ERROR`

## 4. 兜底策略（如仍偶发）
- 仅对 `act.adapt-learn.online` 临时关闭 http2，回退到 HTTP/1.1 验证稳定性：
  - 将 `listen 443 ssl http2;` 改为 `listen 443 ssl;`
- 若关闭后稳定，说明问题集中在网关 HTTP/2 流处理；再单独排查 TLS/网关版本。

## 5. 与本地代码改动的配套说明
- 首页支持“管理员切换动态模型渲染”。
- 默认策略偏向静态首屏，弱网自动静态回退。
- 仿真入口链路已关闭重型页面预取（`prefetch={false}`），降低 `_rsc` 并发压力。
