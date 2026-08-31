import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const deployScript = read('deploy/podman/deploy.sh');
const serviceScript = read('deploy/podman/configure-service.sh');
const remoteDeployScript = read('scripts/remote-deploy.sh');

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
  /require_konling_mode_context_secret\(\)/,
  'Podman 部署脚本必须定义控灵 mode context 签名密钥门禁，避免路径顾问上线后无法签发上下文',
);

assert.match(
  deployScript,
  /KONLING_SERVER_MODE_CONTEXT_SECRET="\$\{KONLING_SERVER_MODE_CONTEXT_SECRET:-\$\{KONLING_MODE_CONTEXT_SECRET:-\}\}"/,
  'Podman 部署脚本必须兼容 KONLING_MODE_CONTEXT_SECRET 并归一到 KONLING_SERVER_MODE_CONTEXT_SECRET',
);

assert.match(
  deployScript,
  /replace-with-strong-konling-context-secret/,
  'Podman 部署脚本必须拒绝占位 KONLING_SERVER_MODE_CONTEXT_SECRET',
);

assert.match(
  deployScript,
  /require_konling_mode_context_secret\(\)/,
  'Podman 部署脚本必须在启动应用与 worker 前校验控灵 mode context 签名密钥',
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
  /wait_for_node_tcp "\$DB_CONTAINER_IP" 5432/,
  'Podman 部署脚本必须在启动应用前基于容器 IP 等待数据库 TCP 可连通，避免 DNS 抖动',
);

assert.match(
  deployScript,
  /wait_for_node_tcp "\$REDIS_CONTAINER_IP" 6379/,
  'Podman 部署脚本必须在启动应用与 worker 前基于容器 IP 等待 Redis TCP 可连通，避免 DNS 抖动',
);

assert.match(
  deployScript,
  /resolve_container_ip\(\)/,
  'Podman 部署脚本必须定义容器 IP 解析逻辑，为应用与 worker 注入静态主机映射',
);

assert.match(
  deployScript,
  /DB_CONTAINER_IP="\$\(resolve_container_ip "\$DB_CONTAINER"\)"/,
  'Podman 部署脚本必须在启动应用前解析数据库容器 IP',
);

assert.match(
  deployScript,
  /REDIS_CONTAINER_IP="\$\(resolve_container_ip "\$REDIS_CONTAINER"\)"/,
  'Podman 部署脚本必须在启动应用前解析 Redis 容器 IP',
);

assert.equal(
  deployScript.includes('DB_HOST_ARGS=(--add-host "${DB_CONTAINER}:${DB_CONTAINER_IP}" --add-host "${DB_CONTAINER}.dns.podman:${DB_CONTAINER_IP}")'),
  true,
  'Podman 部署脚本必须为数据库同时注入短主机名与 dns.podman 主机映射，绕开 Node getaddrinfo 抖动',
);

assert.equal(
  deployScript.includes('REDIS_HOST_ARGS=(--add-host "${REDIS_CONTAINER}:${REDIS_CONTAINER_IP}" --add-host "${REDIS_CONTAINER}.dns.podman:${REDIS_CONTAINER_IP}")'),
  true,
  'Podman 部署脚本必须为 Redis 同时注入短主机名与 dns.podman 主机映射，绕开 Node getaddrinfo 抖动',
);

assert.equal(
  deployScript.includes('"${DB_HOST_ARGS[@]}"') && deployScript.includes('"${REDIS_HOST_ARGS[@]}"'),
  true,
  'Podman 部署脚本必须在应用与 worker 容器启动参数中附带数据库与 Redis 的主机映射',
);

assert.match(
  deployScript,
  /write_runtime_env "\$APP_PORT" "\$REDIS_URL"/,
  'Podman 部署脚本必须在部署阶段写入 runtime env，向后续步骤暴露当前应用端口与运行参数',
);

assert.ok(
  remoteDeployScript.split("grep -q '^KONLING_SERVER_MODE_CONTEXT_SECRET='").length - 1 >= 2,
  '远端一键部署验收必须确认应用与 worker 容器实际注入 KONLING_SERVER_MODE_CONTEXT_SECRET',
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

assert.match(
  serviceScript,
  /APP_DEPLOY_SCRIPT="\$\{APP_DEPLOY_SCRIPT:-\$\{PROJECT_DIR\}\/scripts\/4-deploy\.sh\}"/,
  'systemd 配置脚本必须显式引用远端同步后的 4-deploy.sh，以便在开机时重建依赖静态主机映射的应用容器',
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
  serviceScript.includes('ExecStart=/bin/sh -lc \'APP_IMAGE=${APP_IMAGE} ACT_KNOWLEDGE_DEPLOYMENT_MODE=${ACT_KNOWLEDGE_DEPLOYMENT_MODE} "${APP_DEPLOY_SCRIPT}" --app-only\''),
  true,
  'systemd 配置脚本必须在数据库就绪后以冻结镜像和知识部署模式重新执行 4-deploy.sh --app-only，重建应用、Redis 与 worker 容器',
);

assert.match(
  serviceScript,
  /APP_IMAGE 含有 systemd unit 不允许的字符/,
  'systemd 配置脚本必须拒绝不能安全嵌入 ExecStart 的镜像标识',
);

assert.equal(
  serviceScript.includes('ExecStart=/usr/bin/podman start ${REDIS_CONTAINER}'),
  false,
  'systemd 配置脚本不得直接启动旧的 Redis 容器，否则会导致随后重建出的静态主机映射失配',
);

assert.equal(
  serviceScript.includes('ExecStart=/usr/bin/podman start ${APP_CONTAINER}'),
  false,
  'systemd 配置脚本不得直接启动旧的应用容器，否则会复用过期的静态主机映射',
);

assert.equal(
  serviceScript.includes('ExecStart=/usr/bin/podman start ${WORKER_CONTAINER}'),
  false,
  'systemd 配置脚本不得直接启动旧的 worker 容器，否则会复用过期的静态主机映射',
);

assert.equal(
  serviceScript.includes('ExecStartPost=/bin/sh -lc \'for i in 1 2 3 4 5 6 7 8 9 10; do /usr/bin/podman exec ${WORKER_CONTAINER} ./node_modules/.bin/tsx scripts/workers/scheduler.ts && exit 0; sleep 3; done; exit 1\''),
  false,
  'systemd 配置脚本不应再单独执行 scheduler.ts，因为 4-deploy.sh --app-only 已内置该初始化流程',
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
