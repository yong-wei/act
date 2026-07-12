import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '../..');
const installerPath = path.join(projectRoot, 'scripts/skillopt-sleep-install.sh');
const runnerPath = path.join(projectRoot, 'scripts/skillopt-sleep.sh');
const configPath = path.join(projectRoot, 'tools/skillopt-sleep/config.json');
const requirementPath = path.join(projectRoot, 'tools/skillopt-sleep/requirements.txt');
const skillPath = path.join(projectRoot, '.agents/skills/skillopt-sleep/SKILL.md');
const skillsReadmePath = path.join(projectRoot, '.agents/skills/README.md');
const skillsManifestPath = path.join(projectRoot, '.agents/skills/manifest.json');
const packagePath = path.join(projectRoot, 'package.json');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertExecutable(filePath) {
  assert.equal(fs.existsSync(filePath), true, `${filePath} must exist`);
  assert.equal(fs.statSync(filePath).mode & 0o111, 0o111, `${filePath} must be executable`);
}

assertExecutable(installerPath);
assertExecutable(runnerPath);

const installer = read(installerPath);
const runner = read(runnerPath);
const config = JSON.parse(read(configPath));
const requirements = read(requirementPath).trim();
const skill = read(skillPath);
const skillsReadme = read(skillsReadmePath);
const skillsManifest = JSON.parse(read(skillsManifestPath));
const packageManifest = JSON.parse(read(packagePath));

assert.equal(requirements, 'skillopt==0.2.0');
assert.match(installer, /tools\/skillopt-sleep\/requirements\.txt/);
assert.match(installer, /SKILLOPT_SLEEP_RUNTIME_ROOT/);
assert.match(installer, /RUNTIME_ROOT[\s\S]*venv/);
assert.match(installer, /import skillopt_sleep/);
assert.match(runner, /--project/);
assert.match(runner, /SKILLOPT_SLEEP_PROJECT_ROOT/);
assert.match(runner, /SKILLOPT_SLEEP_TARGET_SKILL_PATH/);
assert.match(runner, /--source codex/);
assert.match(runner, /--target-skill-path/);
assert.match(runner, /openspec-buddy-auto\/SKILL\.md/);
assert.match(runner, /LOCAL_HOME/);
assert.match(runner, /--claude-home[\s\S]*LOCAL_HOME/);
assert.match(runner, /CODEX_HOME_PATH/);
assert.match(runner, /export CODEX_HOME=/);
assert.match(runner, /SKILLOPT_SLEEP_CODEX_PATH/);
assert.match(runner, /LOCAL_HOME[\s\S]*config\.json/);
assert.equal(config.evolve_skill, true);
assert.equal(config.evolve_memory, false);
assert.equal(config.gate_mode, 'on');
assert.equal(config.gate_metric, 'mixed');
assert.equal(config.auto_adopt, false);
assert.equal(config.target_skill_path, '.agents/skills/openspec-buddy-auto/SKILL.md');
assert.match(skill, /^name:?\s+skillopt-sleep/m);
assert.match(skill, /scripts\/skillopt-sleep\.sh/);
assert.match(skill, /auto-adopt|adopt/i);
assert.match(skillsReadme, /`skillopt-sleep`/);
assert.ok(
  skillsManifest.skills.some(
    (entry) => entry.name === 'skillopt-sleep' && entry.path === 'skillopt-sleep/SKILL.md',
  ),
);
assert.equal(packageManifest.scripts['test:skillopt-sleep'], 'node ./scripts/tests/test-skillopt-sleep.mjs');

console.log('skillopt-sleep contract: PASS');
