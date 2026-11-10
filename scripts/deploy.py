"""Deploy a resolved release without building or moving the successful record early."""
import datetime
import json
import os
import re
import shlex
from pathlib import Path
import shutil
import subprocess
import tempfile

from release import validate_release


def command(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, **kwargs)


def write_json(path, value):
    # A failed process must not leave a truncated deployment record.
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


def deploy():
    os.umask(0o077)
    root = Path(os.environ["DEPLOY_DIR"])
    # Do not allow staging over broad system directories or symlink aliases.
    if not root.is_absolute() or len(root.parts) < 4 or root.resolve() != root:
        raise ValueError("DEPLOY_DIR must be an absolute dedicated app directory without symlinks")
    app_env = os.environ["APP_ENV"]
    if not app_env.strip():
        raise ValueError("APP_ENV is required")
    # Keep identity explicit while resolving env_file and bind paths relative
    # to the candidate, not the stale legacy checkout at DEPLOY_DIR.
    project_name = None
    for line in app_env.splitlines():
        key, separator, value = line.strip().removeprefix("export ").partition("=")
        if separator and key.strip() == "COMPOSE_PROJECT_NAME":
            values = shlex.split(value, comments=True)
            project_name = values[0] if len(values) == 1 else None
    if not project_name or not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", project_name):
        raise ValueError("APP_ENV must set a literal COMPOSE_PROJECT_NAME matching the existing production project")
    release = json.loads(Path("release.json").read_text())
    validate_release(release, os.environ["GITHUB_REPOSITORY"], os.environ["EXPECTED_RUN_ID"], release["run_attempt"], os.environ["EXPECTED_SHA"])
    root.mkdir(parents=True, exist_ok=True)
    history = root / ".deployments"
    history.mkdir(exist_ok=True)
    releases = root / "releases"
    releases.mkdir(exist_ok=True)
    runtime = Path(tempfile.mkdtemp(prefix=f"{release['run_id']}-{release['run_attempt']}-", dir=releases))
    record = {**release, "runtime_dir": str(runtime), "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "deployment_run_id": os.environ["GITHUB_RUN_ID"]}
    write_json(history / "attempt.json", {**record, "status": "deploying"})
    try:
        candidate = Path("candidate")
        files = ["docker-compose.yml", "docker-compose.production.yml"]
        if os.environ.get("MCP_HTTP_ENABLED") == "true":
            files.append("docker-compose.mcp-http.yml")
        for name in files:
            shutil.copyfile(candidate / name, runtime / name)
        (runtime / ".env").write_text(app_env + "\n")
        write_json(runtime / "release.json", release)
        write_json(runtime / "images.json", {"services": {service: {"image": image} for service, image in release["images"].items()}})
        # Keep the existing project identity (DEPLOY_DIR basename or .env override),
        # even though each candidate has its own runtime directory.
        base = ["docker", "compose", "--project-directory", str(runtime), "--project-name", project_name, "--env-file", str(runtime / ".env")]
        for name in files + ["images.json"]:
            base.extend(["-f", str(runtime / name)])
        rendered = json.loads(command(*base, "config", "--format", "json", capture_output=True).stdout)
        for service in ("api", "web", "mcp"):
            rendered["services"][service].pop("build", None)
            if rendered["services"][service]["image"] != release["images"][service]:
                raise ValueError("Compose image does not match release")
        rendered.get("secrets", {}).pop("github_token", None)
        # Rendered configuration contains runtime secrets. The private file stays
        # on the host and is never logged or uploaded as an Actions artifact.
        write_json(runtime / "compose.json", rendered)
        compose = ["docker", "compose", "--project-directory", str(runtime), "--project-name", project_name, "-f", str(runtime / "compose.json")]
        command(*compose, "pull", "api", "web", "mcp")
        command(*compose, "run", "--rm", "--no-deps", "--no-build", "--pull", "never", "api", "node", "packages/api/dist/db/migrate.js")
        command(*compose, "up", "-d", "--no-build", "--pull", "never", "--remove-orphans", "--wait", "--wait-timeout", "180")
        for path in ("/api/readiness", "/"):
            command("curl", "--fail", "--silent", "--show-error", "--max-time", "15", "--retry", "10", "--retry-delay", "3", "--retry-all-errors", "--output", "/dev/null", "https://cookbook.szarans.ca" + path)
        command(*compose, "ps")
        current = history / "current.json"
        if current.exists():
            write_json(history / "previous.json", json.loads(current.read_text()))
        # current is changed only after all readiness checks have succeeded.
        pending_link = root / ".current-next"
        pending_link.unlink(missing_ok=True)
        pending_link.symlink_to(runtime, target_is_directory=True)
        pending_link.replace(root / "current")
        record.update(status="healthy", completed_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
        write_json(current, record)
        write_json(history / "attempt.json", record)
    except Exception:
        write_json(history / "attempt.json", {**record, "status": "failed"})
        # No automatic rollback: migrations may already have changed the schema.
        raise
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
        summary.write(f"Deployed `{release['sha']}` from CI run {release['run_id']}.\n\nSuccessful record: `{history / 'current.json'}`\n")


if __name__ == "__main__":
    deploy()
