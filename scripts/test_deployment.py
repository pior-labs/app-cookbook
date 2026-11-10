"""Exercise release identity and failure boundaries without Docker or production data."""
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import shutil
import unittest
import zipfile
from unittest.mock import patch

import deploy
import release as releases
from release import validate_release

SOURCE_ROOT = Path(__file__).resolve().parent.parent
REPOSITORY = "pior-labs/app-cookbook"
SHA = "a" * 40
RELEASE = {
    "repository": REPOSITORY, "run_id": 123, "run_attempt": 2, "sha": SHA,
    "images": {service: f"ghcr.io/{REPOSITORY}-{service}@sha256:{'b' * 64}" for service in ("api", "web", "mcp")},
}


class ReleaseTests(unittest.TestCase):
    def test_digest_release_accepts_exact_identity(self):
        self.assertEqual(validate_release(RELEASE, REPOSITORY, 123, 2, SHA), RELEASE)

    def test_rejects_other_runs_attempts_repositories_and_commits(self):
        for key, value in (("run_id", 124), ("run_attempt", 1), ("repository", "someone/fork"), ("sha", "c" * 40)):
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_release({**RELEASE, key: value}, REPOSITORY, 123, 2, SHA)

    def test_rejects_mutable_tags_foreign_images_and_partial_releases(self):
        for value in ("ghcr.io/pior-labs/app-cookbook-api:latest", "ghcr.io/someone/api@sha256:" + "b" * 64, "sha256:bad"):
            with self.subTest(image=value), self.assertRaises(ValueError):
                validate_release({**RELEASE, "images": {**RELEASE["images"], "api": value}}, REPOSITORY, 123, 2, SHA)
        with self.assertRaises(ValueError):
            validate_release({**RELEASE, "images": {"api": RELEASE["images"]["api"]}}, REPOSITORY, 123, 2, SHA)


class ResolutionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.old_cwd = Path.cwd()
        os.chdir(self.temp.name)
        self.addCleanup(os.chdir, self.old_cwd)
        self.environment = patch.dict(os.environ, {"GITHUB_REPOSITORY": REPOSITORY, "CI_RUN_ID": "123", "CI_RUN_ATTEMPT": "", "GH_TOKEN": "test-token", "GITHUB_OUTPUT": "output", "GITHUB_STEP_SUMMARY": "summary"})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.run = {"workflow_id": 42, "event": "push", "head_branch": "main", "status": "completed", "conclusion": "success", "head_repository": {"full_name": REPOSITORY}, "head_sha": SHA, "run_attempt": 2}
        self.manifest = RELEASE
        self.expired = False
        self.comparison = "ahead"

    def response(self, request, timeout):
        url = request.full_url
        if url.endswith("/actions/runs/123") or url.endswith("/actions/runs/123/attempts/2"):
            value = self.run
        elif url.endswith("/actions/workflows/ci.yml"):
            value = {"id": 42}
        elif "/compare/" in url:
            value = {"status": self.comparison}
        elif "/artifacts?" in url:
            value = {"artifacts": [{"id": 10, "name": "cookbook-release-2", "expired": self.expired}]}
        elif url.endswith("/artifacts/10/zip"):
            data = io.BytesIO()
            with zipfile.ZipFile(data, "w") as archive:
                archive.writestr("release.json", json.dumps(self.manifest))
            return io.BytesIO(data.getvalue())
        else:
            raise AssertionError(url)
        return io.BytesIO(json.dumps(value).encode())

    def resolve(self):
        with patch("urllib.request.build_opener") as opener:
            opener.return_value.open.side_effect = self.response
            releases.resolve()

    def test_resolves_successful_run_and_writes_exact_manifest(self):
        self.resolve()
        self.assertEqual(json.loads(Path("release.json").read_text()), RELEASE)
        self.assertEqual(Path("output").read_text(), "sha=" + SHA + "\nattempt=2\n")

    def test_can_select_exact_successful_attempt_for_rollback(self):
        with patch.dict(os.environ, {"CI_RUN_ATTEMPT": "2"}):
            self.resolve()
        self.assertEqual(json.loads(Path("release.json").read_text())["run_attempt"], 2)

    def test_rejects_failed_pr_foreign_and_unfinished_runs(self):
        original = dict(self.run)
        for key, value in (("workflow_id", 99), ("event", "pull_request"), ("head_branch", "feature"), ("status", "in_progress"), ("conclusion", "failure"), ("head_repository", {"full_name": "someone/fork"})):
            self.run = {**original, key: value}
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.resolve()
        self.assertFalse(Path("release.json").exists())

    def test_rejects_expired_artifacts_and_commits_outside_main(self):
        self.expired = True
        with self.assertRaises(ValueError):
            self.resolve()
        self.expired = False
        self.comparison = "diverged"
        with self.assertRaises(ValueError):
            self.resolve()

    def test_rejects_artifact_from_different_attempt(self):
        self.manifest = {**RELEASE, "run_attempt": 1}
        with self.assertRaises(ValueError):
            self.resolve()


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.workspace = Path(self.temp.name)
        self.old_cwd = Path.cwd()
        os.chdir(self.workspace)
        self.addCleanup(os.chdir, self.old_cwd)
        Path("candidate").mkdir()
        for name in ("docker-compose.yml", "docker-compose.production.yml", "docker-compose.mcp-http.yml"):
            Path("candidate", name).write_text("services: {}\n")
        Path("release.json").write_text(json.dumps(RELEASE))
        self.root = self.workspace / "cookbook"
        self.history = self.root / ".deployments"
        self.history.mkdir(parents=True)
        self.previous = {"sha": "d" * 40, "run_id": 100, "status": "healthy"}
        (self.history / "current.json").write_text(json.dumps(self.previous))
        self.environment = patch.dict(os.environ, {"DEPLOY_DIR": str(self.root), "APP_ENV": "SECRET=private", "COMPOSE_PROJECT_NAME": "cookbook", "GITHUB_REPOSITORY": REPOSITORY, "GITHUB_RUN_ID": "456", "GITHUB_STEP_SUMMARY": str(self.workspace / "summary"), "MCP_HTTP_ENABLED": "true", "EXPECTED_SHA": SHA, "EXPECTED_RUN_ID": "123", "EXPECTED_ATTEMPT": "2"})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.old_umask = os.umask(0o022)
        self.addCleanup(os.umask, self.old_umask)
        self.calls = []

    def run_command(self, *args, **kwargs):
        self.calls.append(args)
        if "config" in args:
            rendered = {"services": {service: {"image": image, "build": {"context": "."}} for service, image in RELEASE["images"].items()}, "secrets": {"github_token": {"environment": "GITHUB_TOKEN"}}}
            return subprocess.CompletedProcess(args, 0, stdout=json.dumps(rendered))
        return subprocess.CompletedProcess(args, 0)

    def test_success_uses_only_digests_and_records_after_readiness(self):
        with patch.object(deploy, "command", side_effect=self.run_command):
            deploy.deploy()
        current = json.loads((self.history / "current.json").read_text())
        self.assertEqual(current["sha"], SHA)
        self.assertEqual(current["status"], "healthy")
        self.assertEqual(json.loads((self.history / "previous.json").read_text()), self.previous)
        runtime = Path(current["runtime_dir"])
        rendered = json.loads((runtime / "compose.json").read_text())
        self.assertTrue(all("build" not in service for service in rendered["services"].values()))
        self.assertNotIn("github_token", rendered["secrets"])
        self.assertEqual((runtime / ".env").stat().st_mode & 0o777, 0o600)
        self.assertEqual((self.root / "current").resolve(), runtime)
        self.assertTrue((runtime / "docker-compose.mcp-http.yml").exists())
        commands = [list(args) for args in self.calls]
        migration = next(args for args in commands if "run" in args)
        startup = next(args for args in commands if "up" in args)
        self.assertNotIn("--build", migration)
        self.assertTrue(all(service["pull_policy"] == "never" for service in rendered["services"].values()))
        self.assertIn("--no-deps", migration)
        self.assertIn("--no-build", startup)
        self.assertIn("--wait", startup)
        self.assertEqual([args[-1] for args in commands if args[0] == "curl"], ["https://cookbook.szarans.ca/api/readiness", "https://cookbook.szarans.ca/"])

    def test_failures_preserve_successful_release_and_do_not_auto_rollback(self):
        for failing_phase in ("pull", "run", "up", "curl"):
            self.calls = []
            def fail(*args, **kwargs):
                if failing_phase in args:
                    raise subprocess.CalledProcessError(1, args)
                return self.run_command(*args, **kwargs)
            with self.subTest(phase=failing_phase), patch.object(deploy, "command", side_effect=fail), self.assertRaises(subprocess.CalledProcessError):
                deploy.deploy()
            self.assertEqual(json.loads((self.history / "current.json").read_text()), self.previous)
            self.assertEqual(json.loads((self.history / "attempt.json").read_text())["status"], "failed")
            self.assertFalse((self.history / "previous.json").exists())
            self.assertFalse((self.root / "current").exists())

    @unittest.skipUnless(shutil.which("docker"), "Docker Compose CLI is required for rendering")
    def test_real_compose_reads_candidate_environment_and_preserves_project(self):
        for name in ("docker-compose.yml", "docker-compose.production.yml", "docker-compose.mcp-http.yml"):
            shutil.copyfile(SOURCE_ROOT / name, Path("candidate") / name)
        # Deliberately different from the staged environment: the old deployment
        # must not silently supply env_file values to the new containers.
        (self.root / ".env").write_text("SECRET=stale\n")
        app_env = "COMPOSE_PROJECT_NAME=legacy\n export COMPOSE_PROJECT_NAME=other\nSECRET=candidate\nPLATFORM_DATABASE_URL_FILE=/tmp/fixture-database-url\nPLATFORM_IMAGE_STORAGE_DIR=/tmp/fixture-images\nPLATFORM_MCP_HTTP_TOKEN_FILE=/tmp/fixture-token"
        real_command = deploy.command
        def render_only(*args, **kwargs):
            if "config" in args:
                return real_command(*args, **kwargs)
            return self.run_command(*args, **kwargs)
        with patch.dict(os.environ, {"APP_ENV": app_env}), patch.object(deploy, "command", side_effect=render_only):
            deploy.deploy()
        runtime = (self.root / "current").resolve()
        config = json.loads((runtime / "compose.json").read_text())
        self.assertEqual(config["name"], "cookbook")
        self.assertEqual(config["services"]["api"]["environment"]["COMPOSE_PROJECT_NAME"], "cookbook")
        self.assertEqual((runtime / ".env").read_text().count("COMPOSE_PROJECT_NAME="), 1)
        self.assertEqual(config["services"]["api"]["environment"]["SECRET"], "candidate")
        self.assertTrue(all("build" not in service for service in config["services"].values()))
        real_command("docker", "compose", "-f", str(runtime / "compose.json"), "config", "--quiet", capture_output=True)

    def test_staging_failure_is_recorded_without_touching_production(self):
        Path("candidate/docker-compose.production.yml").unlink()
        with patch.object(deploy, "command") as command, self.assertRaises(FileNotFoundError):
            deploy.deploy()
        command.assert_not_called()
        self.assertEqual(json.loads((self.history / "attempt.json").read_text())["status"], "failed")
        self.assertEqual(json.loads((self.history / "current.json").read_text()), self.previous)

    def test_project_secret_is_required_and_validated_before_writing(self):
        for value in ("", "Bad Name", "cookbook\nOTHER=value", "../cookbook"):
            with self.subTest(value=value), patch.dict(os.environ, {"COMPOSE_PROJECT_NAME": value}), patch.object(deploy, "command") as command, self.assertRaises(ValueError):
                deploy.deploy()
            command.assert_not_called()
        self.assertFalse((self.root / "releases").exists())

    def test_rejects_broad_directory_before_writing(self):
        with patch.dict(os.environ, {"DEPLOY_DIR": "/opt/docker"}), self.assertRaises(ValueError):
            deploy.deploy()


if __name__ == "__main__":
    unittest.main()
