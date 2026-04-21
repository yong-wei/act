import json
import subprocess
import sys
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

    def test_repository_agent_configuration_validates(self) -> None:
        result = self.run_python(VALIDATE_SCRIPT, "--root", str(REPO_ROOT))
        self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
        self.assertIn("validated", result.stdout)
        self.assertIn("5 agent files", result.stdout)

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
