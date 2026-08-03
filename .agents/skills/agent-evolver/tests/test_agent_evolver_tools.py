import json
import subprocess
import sys
import tempfile
import tomllib
import unittest
from pathlib import Path


TESTS_DIR = Path(__file__).resolve().parent
SKILL_DIR = TESTS_DIR.parent
REPO_ROOT = SKILL_DIR.parents[2]
VALIDATE_SCRIPT = SKILL_DIR / "scripts" / "validate_agent_configs.py"
PROPOSE_SCRIPT = SKILL_DIR / "scripts" / "propose_agent_tuning.py"


class AgentEvolverToolTests(unittest.TestCase):
    def run_python(self, script: Path, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(script), *args],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )

    def require_local_agent_configuration(self) -> None:
        if not (REPO_ROOT / ".codex" / "config.toml").exists():
            self.skipTest("project-local .codex configuration is intentionally untracked")

    def test_repository_agent_configuration_validates(self) -> None:
        self.require_local_agent_configuration()
        result = self.run_python(VALIDATE_SCRIPT, "--root", str(REPO_ROOT))
        self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
        self.assertIn("validated", result.stdout)
        self.assertIn("21 agent files", result.stdout)

    def test_repository_agents_use_approved_gpt_56_assignments(self) -> None:
        self.require_local_agent_configuration()
        expected_assignments = {
            "agent-router": ("gpt-5.6-terra", "xhigh"),
            "ai-context-reviewer": ("gpt-5.6-terra", "xhigh"),
            "code-mapper": ("gpt-5.6-luna", "high"),
            "course-pedagogy-reviewer": ("gpt-5.6-terra", "xhigh"),
            "critical-reviewer": ("gpt-5.6-sol", "high"),
            "data-governance-reviewer": ("gpt-5.6-terra", "xhigh"),
            "decision-advisor": ("gpt-5.6-sol", "medium"),
            "deep-debugger": ("gpt-5.6-terra", "max"),
            "explorer-librarian": ("gpt-5.6-luna", "high"),
            "independent-reviewer": ("gpt-5.6-sol", "medium"),
            "long-context-investigator": ("gpt-5.6-terra", "max"),
            "patch-worker": ("gpt-5.6-luna", "max"),
            "performance-reviewer": ("gpt-5.6-terra", "xhigh"),
            "release-sentinel": ("gpt-5.6-sol", "medium"),
            "retro-analyst": ("gpt-5.6-terra", "xhigh"),
            "security-reviewer": ("gpt-5.6-sol", "medium"),
            "simulation-domain-reviewer": ("gpt-5.6-terra", "xhigh"),
            "spark-coder": ("gpt-5.6-luna", "xhigh"),
            "spec-planner": ("gpt-5.6-terra", "xhigh"),
            "test-engineer": ("gpt-5.6-luna", "xhigh"),
            "ui-flow-reviewer": ("gpt-5.6-terra", "xhigh"),
        }
        agent_files = sorted((REPO_ROOT / ".codex" / "agents").glob("*.toml"))
        actual_assignments = {}
        for agent_file in agent_files:
            with agent_file.open("rb") as file_handle:
                agent_config = tomllib.load(file_handle)
            actual_assignments[agent_config["name"]] = (
                agent_config["model"],
                agent_config["model_reasoning_effort"],
            )

        self.assertEqual(actual_assignments, expected_assignments)

    def test_repository_agents_use_declared_sandbox_contract(self) -> None:
        self.require_local_agent_configuration()
        expected_sandboxes = {
            agent_name: "read-only"
            for agent_name in (
                "agent-router",
                "ai-context-reviewer",
                "code-mapper",
                "course-pedagogy-reviewer",
                "critical-reviewer",
                "data-governance-reviewer",
                "decision-advisor",
                "explorer-librarian",
                "independent-reviewer",
                "long-context-investigator",
                "performance-reviewer",
                "release-sentinel",
                "retro-analyst",
                "security-reviewer",
                "simulation-domain-reviewer",
                "spec-planner",
                "ui-flow-reviewer",
            )
        }
        expected_sandboxes.update(
            {
                "deep-debugger": "workspace-write",
                "patch-worker": "workspace-write",
                "spark-coder": "workspace-write",
                "test-engineer": "workspace-write",
            }
        )
        actual_sandboxes = {}
        for agent_file in sorted((REPO_ROOT / ".codex" / "agents").glob("*.toml")):
            with agent_file.open("rb") as file_handle:
                agent_config = tomllib.load(file_handle)
            actual_sandboxes[agent_config["name"]] = agent_config.get("sandbox_mode")

        self.assertEqual(actual_sandboxes, expected_sandboxes)

    def test_reasoning_effort_is_checked_against_model_capabilities(self) -> None:
        cases = [
            ("gpt-5.6-sol", "medium", True),
            ("gpt-5.6-sol", "high", True),
            ("gpt-5.6-sol", "low", False),
            ("gpt-5.6-sol", "xhigh", False),
            ("gpt-5.6-sol", "max", False),
            ("gpt-5.6-sol", "ultra", False),
            ("gpt-5.6-luna", "high", True),
            ("gpt-5.6-luna", "xhigh", True),
            ("gpt-5.6-luna", "max", True),
            ("gpt-5.6-luna", "low", False),
            ("gpt-5.6-luna", "ultra", False),
            ("gpt-5.6-terra", "xhigh", True),
            ("gpt-5.6-terra", "max", True),
            ("gpt-5.6-terra", "high", False),
            ("gpt-5.6-terra", "medium", False),
            ("gpt-5.6-terra", "ultra", False),
            ("gpt-5.5", "medium", False),
            ("gpt-unknown", "medium", False),
        ]

        for model, effort, should_pass in cases:
            with self.subTest(model=model, effort=effort), tempfile.TemporaryDirectory() as temporary_directory:
                root = Path(temporary_directory)
                agents_dir = root / ".codex" / "agents"
                agents_dir.mkdir(parents=True)
                (root / ".codex" / "config.toml").write_text(
                    f"""# project-agent-catalog:start
# - sample-agent | .codex/agents/sample-agent.toml | {model} | {effort} | test agent
# project-agent-catalog:end

[agents]
max_threads = 1
max_depth = 1
""",
                    encoding="utf-8",
                )
                (agents_dir / "sample-agent.toml").write_text(
                    f"""name = \"sample-agent\"
description = \"test agent\"
model = \"{model}\"
model_reasoning_effort = \"{effort}\"
developer_instructions = \"test\"
""",
                    encoding="utf-8",
                )

                result = self.run_python(VALIDATE_SCRIPT, "--root", str(root))
                if should_pass:
                    self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
                else:
                    self.assertNotEqual(result.returncode, 0)

    def test_catalog_must_map_each_agent_exactly_once(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            agents_dir = root / ".codex" / "agents"
            agents_dir.mkdir(parents=True)
            (root / ".codex" / "config.toml").write_text(
                """# project-agent-catalog:start
# - agent-a | .codex/agents/agent-a.toml | gpt-5.6-sol | medium | test agent
# - agent-a | .codex/agents/agent-a.toml | gpt-5.6-sol | medium | duplicate agent
# project-agent-catalog:end

[agents]
max_threads = 1
max_depth = 1
""",
                encoding="utf-8",
            )
            for agent_name in ("agent-a", "agent-b"):
                (agents_dir / f"{agent_name}.toml").write_text(
                    f"""name = \"{agent_name}\"
description = \"test agent\"
model = \"gpt-5.6-sol\"
model_reasoning_effort = \"medium\"
developer_instructions = \"test\"
""",
                    encoding="utf-8",
                )

            result = self.run_python(VALIDATE_SCRIPT, "--root", str(root))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("duplicate agent id", result.stderr)

    def test_catalog_rejects_nested_agent_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            agents_dir = root / ".codex" / "agents"
            agents_dir.mkdir(parents=True)
            (root / ".codex" / "config.toml").write_text(
                """# project-agent-catalog:start
# - agent-a | .codex/agents/not-real/agent-a.toml | gpt-5.6-sol | medium | test agent
# project-agent-catalog:end

[agents]
max_threads = 1
max_depth = 1
""",
                encoding="utf-8",
            )
            (agents_dir / "agent-a.toml").write_text(
                """name = \"agent-a\"
description = \"test agent\"
model = \"gpt-5.6-sol\"
model_reasoning_effort = \"medium\"
developer_instructions = \"test\"
""",
                encoding="utf-8",
            )

            result = self.run_python(VALIDATE_SCRIPT, "--root", str(root))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("exactly", result.stderr)

    def test_invalid_fixture_is_rejected(self) -> None:
        fixture_root = TESTS_DIR / "fixtures" / "invalid-project"
        result = self.run_python(VALIDATE_SCRIPT, "--root", str(fixture_root))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("developer_instructions", result.stderr)

    def test_tuning_suggestions_flag_unhealthy_agents(self) -> None:
        ledger_path = TESTS_DIR / "fixtures" / "sample-quality-ledger.jsonl"
        result = self.run_python(PROPOSE_SCRIPT, "--ledger", str(ledger_path))
        self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["summary"]["agent_count"], 3)
        affected = {item["agent"] for item in payload["suggestions"]}
        self.assertIn("critical-reviewer", affected)
        self.assertIn("spark-coder", affected)


if __name__ == "__main__":
    unittest.main()
