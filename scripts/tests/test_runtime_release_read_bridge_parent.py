import importlib.util
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/runtime-release/runtime-release-oss-publisher-bridge.py"
MODULE_SPEC = importlib.util.spec_from_file_location("runtime_release_read_bridge_parent_test_module", str(SCRIPT))
BRIDGE = importlib.util.module_from_spec(MODULE_SPEC)
MODULE_SPEC.loader.exec_module(BRIDGE)


class FakePrctl:
    def __init__(self):
        self.calls = []

    def __call__(self, *args):
        self.calls.append(args)
        return 0


class FakeLibc:
    def __init__(self, prctl):
        self.prctl = prctl


class ReadBridgeParentLifetimeTests(unittest.TestCase):
    def test_linux_bridge_arms_parent_death_signal(self):
        prctl = FakePrctl()
        with mock.patch.object(BRIDGE.sys, "platform", "linux"), \
             mock.patch.object(BRIDGE.os, "getppid", side_effect=[4242, 4242]), \
             mock.patch.object(BRIDGE.ctypes, "CDLL", return_value=FakeLibc(prctl)):
            BRIDGE.bind_read_bridge_to_ssh_parent()

        self.assertEqual(prctl.calls, [(BRIDGE.PR_SET_PDEATHSIG, BRIDGE.signal.SIGTERM, 0, 0, 0)])

    def test_parent_exit_during_setup_fails_closed(self):
        prctl = FakePrctl()
        with mock.patch.object(BRIDGE.sys, "platform", "linux"), \
             mock.patch.object(BRIDGE.os, "getppid", side_effect=[4242, 1]), \
             mock.patch.object(BRIDGE.ctypes, "CDLL", return_value=FakeLibc(prctl)):
            with self.assertRaisesRegex(RuntimeError, "SSH parent exited"):
                BRIDGE.bind_read_bridge_to_ssh_parent()

    def test_non_linux_bridge_does_not_require_prctl(self):
        with mock.patch.object(BRIDGE.sys, "platform", "darwin"), \
             mock.patch.object(BRIDGE.ctypes, "CDLL") as library:
            BRIDGE.bind_read_bridge_to_ssh_parent()

        library.assert_not_called()


if __name__ == "__main__":
    unittest.main()
