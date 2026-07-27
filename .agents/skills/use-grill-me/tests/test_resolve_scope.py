from __future__ import annotations

import importlib.util
import os
from datetime import datetime
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).parents[1] / 'scripts' / 'resolve_scope.py'
SPEC = importlib.util.spec_from_file_location('resolve_scope', SCRIPT_PATH)
assert SPEC and SPEC.loader
resolve_scope = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(resolve_scope)


class ResolveScopeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp_dir.name) / 'sample-worktree'
        self.repo.mkdir()
        self.git('init', '--quiet', '--initial-branch=main')
        self.git('config', 'user.name', 'Test User')
        self.git('config', 'user.email', 'test@example.com')

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def git(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ['git', '-C', str(self.repo), *args],
            check=True,
            capture_output=True,
            text=True,
        )

    def test_explicit_scope_has_highest_priority(self) -> None:
        self.git('config', 'grill.scopeId', 'configured')
        with patch.dict(os.environ, {'GRILL_SCOPE_ID': 'environment'}, clear=True):
            result = resolve_scope.resolve(self.repo, 'issue-995-delivery')
        self.assertEqual(result['scopeId'], 'issue-995-delivery')

    def test_default_scope_is_session_based(self) -> None:
        result = resolve_scope.resolve(
            self.repo,
            now=datetime(2026, 7, 24, 14, 0),
        )
        self.assertEqual(result['scopeId'], '20260724-pm')

    def test_scope_sanitization_is_stable(self) -> None:
        self.assertEqual(resolve_scope.sanitize_scope('team-api'), 'team-api')
        self.assertRegex(
            resolve_scope.sanitize_scope('团队甲'),
            r'^scope-[a-f0-9]{12}$',
        )
        self.assertNotEqual(
            resolve_scope.sanitize_scope('feature/a-b'),
            resolve_scope.sanitize_scope('feature-a/b'),
        )

    def test_global_scan_includes_task_manifests(self) -> None:
        files = {
            'CONTEXT.md': 'root',
            'docs/contexts/billing/CONTEXT.md': 'billing',
            'docs/adr/20240101-root.md': 'adr',
            'docs/grill/alpha/CONTEXT.md': 'alpha',
            'docs/grill/alpha/adr/20240102-alpha.md': 'alpha adr',
            'docs/grill/alpha/manifest.json': '{}',
            'docs/grill/zeta/manifest.json': '{}',
            'docs/grill/README.md': 'not a task',
        }
        for relative_path, content in files.items():
            path = self.repo / relative_path
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')

        result = resolve_scope.resolve(self.repo, 'issue-995-delivery')

        self.assertEqual(
            result['globalContextFiles'],
            [
                'CONTEXT.md',
                'docs/contexts/billing/CONTEXT.md',
                'docs/grill/alpha/CONTEXT.md',
            ],
        )
        self.assertEqual(
            result['globalManifestFiles'],
            [
                'docs/grill/alpha/manifest.json',
                'docs/grill/zeta/manifest.json',
            ],
        )
        self.assertEqual(
            result['manifestPath'],
            'docs/grill/issue-995-delivery/manifest.json',
        )


if __name__ == '__main__':
    unittest.main()
