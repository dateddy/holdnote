#!/usr/bin/env python3
"""Pre-commit secret scan for HoldNote.

Looks only at staged files (the version in the index, not the working tree) and blocks the
commit on: env files, legacy/data, files over 5 MB, merge conflict markers, and strings that
look like real keys. Found values are never printed in full.

Installed via `git config core.hooksPath .githooks` (root `pnpm install` runs it).
"""

from __future__ import annotations

import base64
import json
import re
import subprocess
import sys
from pathlib import PurePosixPath

MAX_BYTES = 5 * 1024 * 1024

# Patterns are assembled from pieces so this file does not match itself.
SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("Supabase secret key", re.compile(r"\b" + "sb_" + "secret_" + r"[A-Za-z0-9_-]{6,}")),
    ("OpenRouter key", re.compile(r"\b" + "sk-" + "or-" + r"[A-Za-z0-9-]{10,}")),
    ("Anthropic key", re.compile(r"\b" + "sk-" + "ant-" + r"[A-Za-z0-9_-]{10,}")),
    ("AWS access key", re.compile(r"\b" + "AKIA" + r"[0-9A-Z]{16}\b")),
    ("private key", re.compile("-----BEGIN " + r"(?:[A-Z]+ )?" + "PRIVATE KEY-----")),
    ("service_role claim", re.compile(r'"role"\s*:\s*"' + "service" + "_role" + '"')),
]
JWT = re.compile(r"\beyJ[A-Za-z0-9_-]{5,}\.(eyJ[A-Za-z0-9_-]{5,})\.[A-Za-z0-9_-]{10,}")
CONFLICT = re.compile(r"^(?:" + "<" * 7 + "|" + ">" * 7 + r")(?: |$)", re.MULTILINE)


def git(*args: str) -> bytes:
    return subprocess.run(["git", *args], check=True, capture_output=True).stdout


def staged_paths() -> list[str]:
    out = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
    return [p for p in out.decode("utf-8", "replace").split("\0") if p]


def preview(value: str) -> str:
    return value[:6] + "..."


def is_env_file(path: str) -> bool:
    name = PurePosixPath(path).name
    return (name == ".env" or name.startswith(".env.")) and name != ".env.example"


def jwt_is_service_role(payload_b64: str) -> bool:
    try:
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        claims = json.loads(base64.urlsafe_b64decode(padded))
    except (ValueError, json.JSONDecodeError):
        return False
    return isinstance(claims, dict) and claims.get("role") == "service" + "_role"


def line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def scan_file(path: str) -> list[str]:
    problems: list[str] = []
    if is_env_file(path):
        problems.append(f"{path}: env file must not be committed (only .env.example)")
    if path.startswith("legacy/data/"):
        problems.append(f"{path}: legacy/data holds real opponent names (DEC-011)")

    size = int(git("cat-file", "-s", f":{path}").strip())
    if size > MAX_BYTES:
        problems.append(f"{path}: {size / 1024 / 1024:.1f} MB is over the 5 MB limit")
        return problems

    blob = git("show", f":{path}")
    if b"\0" in blob:
        return problems  # binary: size checked, no text patterns
    text = blob.decode("utf-8", "replace")

    for m in CONFLICT.finditer(text):
        problems.append(f"{path}:{line_of(text, m.start())}: merge conflict marker")
    for label, pattern in SECRET_PATTERNS:
        for m in pattern.finditer(text):
            problems.append(f"{path}:{line_of(text, m.start())}: {label} ({preview(m.group(0))})")
    for m in JWT.finditer(text):
        if jwt_is_service_role(m.group(1)):
            problems.append(f"{path}:{line_of(text, m.start())}: service_role JWT ({preview(m.group(0))})")
    return problems


def main() -> int:
    try:
        paths = staged_paths()
    except subprocess.CalledProcessError as e:
        print(f"precommit_scan: git failed: {e}", file=sys.stderr)
        return 1

    problems = [p for path in paths for p in scan_file(path)]
    if not problems:
        return 0

    print("Commit blocked by scripts/precommit_scan.py:", file=sys.stderr)
    for p in problems:
        print(f"  - {p}", file=sys.stderr)
    print(
        "Unstage the file (git restore --staged <file>) or remove the secret, then commit again.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
