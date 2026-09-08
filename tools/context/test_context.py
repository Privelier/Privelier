import importlib.util
from pathlib import Path
import unittest

MODULE_PATH = Path(__file__).with_name("context.py")
spec = importlib.util.spec_from_file_location("context", MODULE_PATH)
context = importlib.util.module_from_spec(spec)
spec.loader.exec_module(context)


class ContextToolTests(unittest.TestCase):
    def test_pack_requires_explicit_files(self):
        with self.assertRaisesRegex(SystemExit, "explicit tracked files"):
            context.safe_paths([])

    def test_pack_refuses_directory(self):
        with self.assertRaisesRegex(SystemExit, "not a tracked file"):
            context.safe_paths(["src"])

    def test_pack_refuses_secret_extension(self):
        with self.assertRaises(SystemExit):
            context.safe_paths(["private.key"])

    def test_pack_accepts_tracked_source(self):
        self.assertEqual(context.safe_paths(["src/auth/deepLink.ts"]), ["src/auth/deepLink.ts"])

    def test_budget_accepts_boundaries(self):
        context.enforce_budget(1, 1200)
        context.enforce_budget(1200, 1200)

    def test_budget_rejects_invalid_values(self):
        for value in (0, -1, 1201):
            with self.subTest(value=value), self.assertRaises(SystemExit):
                context.enforce_budget(value, 1200)

    def test_digest_is_stable(self):
        self.assertEqual(context.source_digest(), context.source_digest())


if __name__ == "__main__":
    unittest.main()
