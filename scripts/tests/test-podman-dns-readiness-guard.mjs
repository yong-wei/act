import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const deployScript = read('deploy/podman/deploy.sh');
const serviceScript = read('deploy/podman/configure-service.sh');

assert.match(
  deployScript,
  /wait_for_node_tcp\(\)/,
  'Podman 部署脚本必须定义 Node 侧 TCP 就绪等待逻辑',
);

assert.match(
  deployScript,
  /net\.connect\(\{ host, port \}\)/,
  'Podman 部署脚本必须使用 Node 的 TCP 探针验证数据库与 Redis 真正可连通',
);

assert.match(
  deployScript,
  /DB_DNS_HOST="\$\{DB_DNS_HOST:-\$\{DB_CONTAINER\}\.dns\.podman\}"/,
  'Podman 部署脚本必须使用 Podman FQDN 作为数据库主机名默认值',
);

assert.match(
  deployScript,
  /REDIS_DNS_HOST="\$\{REDIS_DNS_HOST:-\$\{REDIS_CONTAINER\}\.dns\.podman\}"/,
  'Podman 部署脚本必须使用 Podman FQDN 作为 Redis 主机名默认值',
);

assert.match(
  deployScript,
  /wait_for_node_tcp "\$DB_DNS_HOST" 5432/,
  'Podman 部署脚本必须在启动应用前等待数据库 TCP 可连通',
);

assert.match(
  deployScript,
  /wait_for_node_tcp "\$REDIS_DNS_HOST" 6379/,
  'Podman 部署脚本必须在启动应用与 worker 前等待 Redis TCP 可连通',
);

assert.match(
  deployScript,
  /write_runtime_env "\$APP_PORT" "\$REDIS_URL"/,
  'Podman 部署脚本必须在部署阶段写入 runtime env，向后续步骤暴露当前应用端口与运行参数',
);

assert.match(
  deployScript,
  /DB_HOST=\$DB_DNS_HOST/,
  'Podman 部署脚本写入 runtime env 时必须保留数据库 FQDN，避免容器重启后 IP 漂移导致配置失效',
);

assert.match(
  deployScript,
  /START_WRAPPER_PATH="\$\{START_WRAPPER_PATH:-\$\{PROJECT_DIR\}\/scripts\/container-start-wrapper\.sh\}"/,
  'Podman 部署脚本必须约定容器启动包装脚本路径',
);

assert.match(
  deployScript,
  /-v "\$\{START_WRAPPER_PATH\}:\/app-container-start-wrapper\.sh:ro"/,
  'Podman 部署脚本必须把容器启动包装脚本只读挂载进应用与 worker 容器',
);

assert.match(
  deployScript,
  /\/app-container-start-wrapper\.sh app/,
  '应用容器必须经启动包装脚本等待数据库就绪后再进入默认入口',
);

assert.match(
  deployScript,
  /\/app-container-start-wrapper\.sh worker/,
  'worker 容器必须经启动包装脚本等待数据库与 Redis 就绪后再进入默认入口',
);

assert.match(
  serviceScript,
  /wait_for_node_tcp\(\)/,
  'systemd 配置脚本必须定义 Node 侧 TCP 就绪等待逻辑',
);

assert.equal(
  serviceScript.includes('require(\\"node:net\\")'),
  true,
  'systemd 配置脚本生成的 Node TCP 探针必须保留 require("node:net") 引号，避免 unit 转义失效',
);

assert.match(
  serviceScript,
  /DB_DNS_HOST="\$\{DB_DNS_HOST:-\$\{DB_CONTAINER\}\.dns\.podman\}"/,
  'systemd 配置脚本必须使用 Podman FQDN 作为数据库主机名默认值',
);

assert.match(
  serviceScript,
  /REDIS_DNS_HOST="\$\{REDIS_DNS_HOST:-\$\{REDIS_CONTAINER\}\.dns\.podman\}"/,
  'systemd 配置脚本必须使用 Podman FQDN 作为 Redis 主机名默认值',
);

assert.match(
  serviceScript,
  /wait_for_node_tcp "\$DB_DNS_HOST" 5432/,
  'systemd 配置脚本必须在启动应用前等待数据库 TCP 可连通',
);

assert.match(
  serviceScript,
  /wait_for_node_tcp "\$REDIS_DNS_HOST" 6379/,
  'systemd 配置脚本必须在启动应用与 worker 前等待 Redis TCP 可连通',
);

console.log('podman dns readiness guard test passed');
