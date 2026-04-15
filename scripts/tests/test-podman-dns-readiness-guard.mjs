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

assert.equal(
  deployScript.includes('DB_HOST_ALIAS="${DB_HOST_ALIAS:-${DB_CONTAINER}.dns.podman}"'),
  true,
  'Podman 部署脚本必须默认使用数据库 dns.podman 全限定主机名，避免短别名解析抖动',
);

assert.match(
  deployScript,
  /derive_db_password\(\)/,
  'Podman 部署脚本必须在 DB_PASSWORD 缺失时从 DATABASE_URL 提取数据库密码，避免容器与应用密码来源不一致',
);

assert.match(
  deployScript,
  /DB_PASSWORD="\$\{DB_PASSWORD:-\$\{POSTGRES_PASSWORD:-\}\}"/,
  'Podman 部署脚本不得在读取 DATABASE_URL 前直接回落到默认数据库密码',
);

assert.equal(
  deployScript.includes('REDIS_HOST_ALIAS="${REDIS_HOST_ALIAS:-${REDIS_CONTAINER}.dns.podman}"'),
  true,
  'Podman 部署脚本必须默认使用 Redis dns.podman 全限定主机名，避免短别名解析抖动',
);

assert.match(
  deployScript,
  /normalize_public_app_url\(\)/,
  'Podman 部署脚本必须定义公开站点 URL 归一化逻辑，避免生产环境继承 localhost 登录地址',
);

assert.match(
  deployScript,
  /NEXTAUTH_URL="\$\(normalize_public_app_url "\$\{NEXTAUTH_URL:-\}" "\$APP_DOMAIN"\)"/,
  'Podman 部署脚本必须把 localhost NEXTAUTH_URL 归一化为生产域名地址',
);

assert.match(
  deployScript,
  /wait_for_node_tcp "\$DB_HOST_ALIAS" 5432/,
  'Podman 部署脚本必须在启动应用前等待数据库 TCP 可连通',
);

assert.match(
  deployScript,
  /wait_for_node_tcp "\$REDIS_HOST_ALIAS" 6379/,
  'Podman 部署脚本必须在启动应用与 worker 前等待 Redis TCP 可连通',
);

assert.match(
  deployScript,
  /write_runtime_env "\$APP_PORT" "\$REDIS_URL"/,
  'Podman 部署脚本必须在部署阶段写入 runtime env，向后续步骤暴露当前应用端口与运行参数',
);

assert.match(
  deployScript,
  /DB_HOST=\$DB_HOST_ALIAS/,
  'Podman 部署脚本写入 runtime env 时必须保留归一化后的数据库主机名',
);

assert.equal(
  deployScript.includes('redis://${REDIS_CONTAINER}\\\\.dns\\\\.podman:'),
  true,
  'Podman 部署脚本必须兼容并归一化旧的 Redis dns.podman 地址',
);

assert.equal(
  deployScript.includes('@${DB_CONTAINER}\\\\.dns\\\\.podman:'),
  true,
  'Podman 部署脚本必须兼容并归一化旧的数据库 dns.podman 地址',
);

assert.equal(
  deployScript.includes('@localhost:'),
  true,
  'Podman 部署脚本必须兼容并归一化旧的 localhost 数据库地址',
);

assert.match(
  deployScript,
  /ensure_database_url_param\(\)/,
  'Podman 部署脚本必须定义 DATABASE_URL 参数补齐逻辑，确保连接池参数可被补写到旧 URL',
);

assert.match(
  deployScript,
  /DATABASE_URL="\$\(ensure_database_url_param "\$DATABASE_URL" "connection_limit" "10"\)"/,
  'Podman 部署脚本必须在旧 DATABASE_URL 缺少 connection_limit 时自动补写',
);

assert.match(
  deployScript,
  /DATABASE_URL="\$\(ensure_database_url_param "\$DATABASE_URL" "pool_timeout" "20"\)"/,
  'Podman 部署脚本必须在旧 DATABASE_URL 缺少 pool_timeout 时自动补写',
);

assert.equal(
  deployScript.includes('redis://localhost:'),
  true,
  'Podman 部署脚本必须兼容并归一化旧的 localhost Redis 地址',
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
  deployScript,
  /podman container cleanup --rm "\$name"/,
  'Podman 部署脚本删除旧容器时必须在常规删除失败后执行 cleanup --rm，处理 conmon 残留状态',
);

assert.match(
  deployScript,
  /WARNING: 常规删除失败，尝试 cleanup --rm: \$name/,
  'Podman 部署脚本必须在触发 cleanup 回退时输出明确告警',
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

assert.equal(
  serviceScript.includes('DB_HOST_ALIAS="${DB_HOST_ALIAS:-${DB_CONTAINER}.dns.podman}"'),
  true,
  'systemd 配置脚本必须默认使用数据库 dns.podman 全限定主机名，避免短别名解析抖动',
);

assert.match(
  serviceScript,
  /derive_db_password\(\)/,
  'systemd 配置脚本必须在 DB_PASSWORD 缺失时从 DATABASE_URL 提取数据库密码，避免 unit 误用默认密码',
);

assert.match(
  serviceScript,
  /DB_PASSWORD="\$\{DB_PASSWORD:-\$\{POSTGRES_PASSWORD:-\}\}"/,
  'systemd 配置脚本不得在读取 DATABASE_URL 前直接回落到默认数据库密码',
);

assert.match(
  serviceScript,
  /KillMode=none/,
  'systemd 配置脚本生成的 Podman stack unit 必须设置 KillMode=none，避免 systemd 接管并误杀 Podman 子进程',
);

assert.match(
  serviceScript,
  /Delegate=yes/,
  'systemd 配置脚本生成的 Podman stack unit 必须设置 Delegate=yes，允许 Podman 管理容器 cgroup',
);

assert.equal(
  serviceScript.includes('REDIS_HOST_ALIAS="${REDIS_HOST_ALIAS:-${REDIS_CONTAINER}.dns.podman}"'),
  true,
  'systemd 配置脚本必须默认使用 Redis dns.podman 全限定主机名，避免短别名解析抖动',
);

assert.match(
  serviceScript,
  /wait_for_node_tcp "\$DB_HOST_ALIAS" 5432/,
  'systemd 配置脚本必须在启动应用前等待数据库 TCP 可连通',
);

assert.match(
  serviceScript,
  /wait_for_node_tcp "\$REDIS_HOST_ALIAS" 6379/,
  'systemd 配置脚本必须在启动应用与 worker 前等待 Redis TCP 可连通',
);

assert.equal(
  serviceScript.includes('redis://${REDIS_CONTAINER}\\\\.dns\\\\.podman:'),
  true,
  'systemd 配置脚本必须兼容并归一化旧的 Redis dns.podman 地址',
);

assert.equal(
  serviceScript.includes('@${DB_CONTAINER}\\\\.dns\\\\.podman:'),
  true,
  'systemd 配置脚本必须兼容并归一化旧的数据库 dns.podman 地址',
);

assert.equal(
  serviceScript.includes('@localhost:'),
  true,
  'systemd 配置脚本必须兼容并归一化旧的 localhost 数据库地址',
);

assert.match(
  serviceScript,
  /ensure_database_url_param\(\)/,
  'systemd 配置脚本必须定义 DATABASE_URL 参数补齐逻辑，确保旧 URL 也带连接池参数',
);

assert.match(
  serviceScript,
  /DATABASE_URL="\$\(ensure_database_url_param "\$DATABASE_URL" "connection_limit" "10"\)"/,
  'systemd 配置脚本必须在旧 DATABASE_URL 缺少 connection_limit 时自动补写',
);

assert.match(
  serviceScript,
  /DATABASE_URL="\$\(ensure_database_url_param "\$DATABASE_URL" "pool_timeout" "20"\)"/,
  'systemd 配置脚本必须在旧 DATABASE_URL 缺少 pool_timeout 时自动补写',
);

assert.equal(
  serviceScript.includes('redis://localhost:'),
  true,
  'systemd 配置脚本必须兼容并归一化旧的 localhost Redis 地址',
);

console.log('podman dns readiness guard test passed');
