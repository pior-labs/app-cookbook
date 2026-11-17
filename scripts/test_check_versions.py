"""Exercise the runtime version consistency check on temporary fixtures."""
import json
from pathlib import Path
import tempfile
import unittest

import check_versions

DIGEST = "sha256:" + "a" * 64
GOOD_WORKFLOW = """\
jobs:
  validate:
    steps:
      - uses: pnpm/action-setup@0123 # v6
      - uses: actions/setup-node@4567 # v4
        with:
          node-version-file: .node-version
"""


class CheckVersionsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write(".node-version", "26.13.1\n")
        self.write("package.json", json.dumps({"packageManager": "pnpm@10.8.1", "engines": {"node": "26.x"}}))
        self.write("api/Dockerfile", f"FROM node:26.13.1-alpine@{DIGEST} AS build\nFROM caddy:2-alpine\n")
        self.write(".github/workflows/ci.yml", GOOD_WORKFLOW)

    def write(self, path, text):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def problems(self):
        files = [str(p.relative_to(self.root)) for p in self.root.rglob("*") if p.is_file()]
        return check_versions.check(self.root, files)

    def test_consistent_repository_passes(self):
        self.assertEqual(self.problems(), [])

    def test_hash_suffixed_package_manager_passes(self):
        self.write("package.json", json.dumps({"packageManager": "pnpm@10.8.1+sha512.abc", "engines": {"node": "26.x"}}))
        self.assertEqual(self.problems(), [])

    def test_node_version_must_be_exact(self):
        self.write(".node-version", "26\n")
        self.assertIn("exact version", self.problems()[0])

    def test_dockerfile_version_mismatch(self):
        self.write("api/Dockerfile", f"FROM node:26.12.0-alpine@{DIGEST}\n")
        self.assertIn("does not match", self.problems()[0])

    def test_dockerfile_floating_major_fails(self):
        self.write("api/Dockerfile", f"FROM node:26-alpine@{DIGEST}\n")
        self.assertIn("does not match", self.problems()[0])

    def test_dockerfile_requires_digest(self):
        self.write("api/Dockerfile", "FROM --platform=$BUILDPLATFORM node:26.13.1-alpine AS build\n")
        self.assertIn("pinned by digest", self.problems()[0])

    def test_engines_must_allow_node_major(self):
        self.write("package.json", json.dumps({"packageManager": "pnpm@10.8.1", "engines": {"node": ">=22"}}))
        self.assertIn("engines.node", self.problems()[0])

    def test_workflow_must_not_repeat_node_version(self):
        self.write(".github/workflows/ci.yml", GOOD_WORKFLOW.replace("node-version-file: .node-version", "node-version: 26"))
        self.assertIn("node-version-file", self.problems()[0])

    def test_pnpm_action_must_not_repeat_version(self):
        self.write(".github/workflows/ci.yml", GOOD_WORKFLOW.replace(
            "      - uses: pnpm/action-setup@0123 # v6\n",
            "      - uses: pnpm/action-setup@0123 # v6\n        with:\n          version: 10.8.1\n"))
        self.assertIn("pnpm/action-setup repeats", self.problems()[0])

    def test_other_step_version_input_is_ignored(self):
        self.write(".github/workflows/ci.yml", GOOD_WORKFLOW + "      - uses: some/tool@1\n        with:\n          version: 3\n")
        self.assertEqual(self.problems(), [])

    def test_dockerfile_must_not_repeat_pnpm_version(self):
        self.write("api/Dockerfile", f"FROM node:26.13.1-alpine@{DIGEST}\nRUN npm install -g pnpm@10.8.1\n")
        self.assertIn("repeats a pnpm version", self.problems()[0])


if __name__ == "__main__":
    unittest.main()
