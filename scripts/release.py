"""Identify releases by successful main CI runs, never by a mutable image tag."""
import io
import json
import os
import re
import urllib.request
import zipfile
from pathlib import Path

SERVICES = ("api", "web", "mcp")


def validate_release(release, repository, run_id, attempt, sha):
    expected = {"repository": repository, "run_id": int(run_id), "run_attempt": int(attempt), "sha": sha}
    if any(release.get(key) != value for key, value in expected.items()):
        raise ValueError("Release identity does not match the successful CI run")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Invalid commit SHA")
    images = release.get("images", {})
    if set(images) != set(SERVICES):
        raise ValueError("Release must include API, web and MCP images")
    for service in SERVICES:
        prefix = f"ghcr.io/{repository.lower()}-{service}@sha256:"
        if not re.fullmatch(re.escape(prefix) + r"[0-9a-f]{64}", images[service]):
            raise ValueError(f"Invalid {service} image digest")
    return release


def create():
    repository = os.environ["GITHUB_REPOSITORY"]
    release = {
        "repository": repository,
        "run_id": int(os.environ["GITHUB_RUN_ID"]),
        "run_attempt": int(os.environ["GITHUB_RUN_ATTEMPT"]),
        "sha": os.environ["GITHUB_SHA"],
        "images": {service: f"ghcr.io/{repository.lower()}-{service}@{os.environ[service.upper() + '_DIGEST']}" for service in SERVICES},
    }
    validate_release(release, repository, release["run_id"], release["run_attempt"], release["sha"])
    Path("release.json").write_text(json.dumps(release, indent=2) + "\n")


def resolve():
    repository = os.environ["GITHUB_REPOSITORY"]
    run_id = os.environ["CI_RUN_ID"]
    if not re.fullmatch(r"[1-9][0-9]*", run_id):
        raise ValueError("Supply a numeric Cookbook CI run ID")

    def request(path, raw=False):
        req = urllib.request.Request(
            f"https://api.github.com/repos/{repository}/{path}",
            headers={"Authorization": f"Bearer {os.environ['GH_TOKEN']}", "Accept": "application/vnd.github+json"},
        )
        # GitHub redirects archive downloads to signed storage URLs. urllib
        # forwards headers across redirects, so strip Authorization explicitly.
        class Redirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
                if redirected is not None:
                    redirected.remove_header("Authorization")
                return redirected
        with urllib.request.build_opener(Redirect).open(req, timeout=60) as response:
            data = response.read()
        return data if raw else json.loads(data)

    run = request(f"actions/runs/{run_id}")
    workflow = request("actions/workflows/ci.yml")
    if (run["workflow_id"] != workflow["id"] or run["event"] != "push"
            or run["head_branch"] != "main" or run["status"] != "completed"
            or run["conclusion"] != "success"
            or run["head_repository"]["full_name"] != repository):
        raise ValueError("Select a successful push-to-main run of Cookbook CI")
    comparison = request(f"compare/{run['head_sha']}...main")
    if comparison["status"] not in ("ahead", "identical"):
        raise ValueError("Release commit must still belong to main history")
    # Filter by exact attempt-specific name; old rerun artifacts are ineligible.
    name = f"cookbook-release-{run['run_attempt']}"
    artifacts = []
    page = 1
    while True:
        batch = request(f"actions/runs/{run_id}/artifacts?per_page=100&page={page}")["artifacts"]
        artifacts.extend(a for a in batch if a["name"] == name and not a["expired"])
        if len(batch) < 100:
            break
        page += 1
    if len(artifacts) != 1:
        raise ValueError("Release manifest is missing, expired or ambiguous; select another CI run")
    archive = request(f"actions/artifacts/{artifacts[0]['id']}/zip", raw=True)
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        release = json.loads(bundle.read("release.json"))
    validate_release(release, repository, run_id, run["run_attempt"], run["head_sha"])
    Path("release.json").write_text(json.dumps(release, indent=2) + "\n")
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        output.write(f"sha={release['sha']}\n")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
        summary.write(f"Selected CI run {run_id}, attempt {run['run_attempt']}, commit `{release['sha']}`.\n")
        for service, image in release["images"].items():
            summary.write(f"\n- {service}: `{image}`")


if __name__ == "__main__":
    import sys
    {"create": create, "resolve": resolve}[sys.argv[1]]()
