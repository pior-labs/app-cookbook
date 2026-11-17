"""Fail when runtime versions drift from their single sources.

Node: `.node-version` holds the exact version. Dockerfile Node images use that
version pinned by digest, root `engines.node` allows its major (`26.x`), and
workflows read the file instead of repeating a version.
pnpm: root `packageManager` holds the version; Dockerfiles and workflows must
not repeat it.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

VERSION = re.compile(r"\d+\.\d+\.\d+")
NODE_IMAGE = re.compile(r"^\s*FROM\s+(?:--\S+\s+)*(?:docker\.io/)?(?:library/)?node:(\S+)", re.I | re.M)
PNPM_PIN = re.compile(r"pnpm@\d")
SETUP_NODE_VERSION = re.compile(r"^\s*node-version\s*:", re.M)


def is_dockerfile(path):
    name = Path(path).name
    return name == "Dockerfile" or name.startswith("Dockerfile.") or name.endswith(".Dockerfile")


def is_workflow(path):
    return path.startswith(".github/workflows/") and path.endswith((".yml", ".yaml"))


def pnpm_setup_versions(text):
    """Yield line numbers where a pnpm/action-setup step sets `version`."""
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if "uses: pnpm/action-setup" not in line:
            continue
        step_indent = len(line) - len(line.lstrip(" -"))
        for number, following in enumerate(lines[index + 1:], index + 2):
            stripped = following.lstrip(" ")
            if stripped and (len(following) - len(stripped) < step_indent or stripped.startswith("- ")):
                break
            if stripped.startswith("version:"):
                yield number


def check(root, files):
    root = Path(root)
    problems = []

    source = root / ".node-version"
    node = source.read_text().strip() if source.is_file() else ""
    if not VERSION.fullmatch(node):
        return [".node-version must contain one exact version such as 26.13.1"]
    major = node.split(".")[0]

    package = json.loads((root / "package.json").read_text())
    engines = package.get("engines", {}).get("node")
    if engines != f"{major}.x":
        problems.append(f"package.json engines.node is {engines!r}; expected '{major}.x' to match .node-version")
    if not re.fullmatch(r"pnpm@\d+\.\d+\.\d+(\+\S+)?", package.get("packageManager", "")):
        problems.append("package.json packageManager must name an exact pnpm version")

    for path in files:
        if not (root / path).is_file():
            continue
        if is_dockerfile(path):
            text = (root / path).read_text()
            for match in NODE_IMAGE.finditer(text):
                image = match.group(1)
                tag, _, digest = image.partition("@")
                if tag != node and not tag.startswith(node + "-"):
                    problems.append(f"{path}: node:{tag} does not match .node-version {node}")
                if not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
                    problems.append(f"{path}: node:{tag} must be pinned by digest")
            if PNPM_PIN.search(text):
                problems.append(f"{path}: repeats a pnpm version; read packageManager instead")
        elif is_workflow(path):
            text = (root / path).read_text()
            if SETUP_NODE_VERSION.search(text):
                problems.append(f"{path}: sets node-version; use node-version-file: .node-version")
            for number in pnpm_setup_versions(text):
                problems.append(f"{path}:{number}: pnpm/action-setup repeats a version; it reads packageManager")
            if PNPM_PIN.search(text):
                problems.append(f"{path}: repeats a pnpm version; read packageManager instead")
    return problems


def main():
    root = Path(__file__).resolve().parent.parent
    files = subprocess.run(["git", "ls-files"], cwd=root, check=True, capture_output=True, text=True).stdout.split()
    problems = check(root, files)
    for problem in problems:
        print(problem, file=sys.stderr)
    if not problems:
        print("Runtime versions agree with .node-version and packageManager")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
