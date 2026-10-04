#!/usr/bin/env python3
"""Pick the commit a deploy run should ship: the newest commit on the branch that passed CI.

Why (2026-10-04): back-to-back merges fire one deploy per CI run, and CI runs do not finish in
commit order. A deploy that ships "the commit that triggered me" can land an OLDER commit last
(backend), and one that ships "whatever the branch tip is now" can ship a tip whose CI is still
running or failed (frontend). Every deploy run instead asks GitHub, walking the branch from its tip:

- a commit whose CI is still running  -> skip: that commit's own CI completion triggers a deploy;
- a commit whose CI passed            -> deploy exactly that commit;
- a commit whose CI failed/cancelled  -> never deploy it; keep walking back;
- a commit CI never ran for (paths filter: docs, scripts) -> nothing to verify; keep walking back.

Whichever deploy run executes last therefore always ships the newest verified commit.

Usage (in a workflow step; needs GITHUB_TOKEN with actions:read + contents:read):
  python3 pick_deploy_sha.py --repo owner/name --branch main --ci-workflow backend-ci.yml \
      --trigger-sha <sha>       # prints deploy=true|false, sha=<40 hex>, reason=... (GITHUB_OUTPUT format)
  python3 pick_deploy_sha.py --self-test
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
from typing import Callable, List, Optional, Tuple

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
WINDOW = 30  # commits walked back from the tip


def pick(commits: List[str], ci_run: Callable[[str], Optional[Tuple[str, Optional[str]]]],
         trigger_sha: str) -> Tuple[bool, str, str]:
    """(deploy?, sha, reason). `commits` newest first; `ci_run(sha)` gives (status, conclusion) of
    the latest push run of the CI workflow for that commit, or None when CI never ran for it."""
    for sha in commits:
        run = ci_run(sha)
        if run is None:
            continue
        status, conclusion = run
        if status != "completed":
            return False, sha, f"{sha[:7]} is still in CI; its own deploy follows"
        if conclusion == "success":
            return True, sha, f"newest commit that passed CI is {sha[:7]}"
    # Nothing verified inside the window (very long docs-only streak): ship what triggered us,
    # which this workflow_run only fires for after a successful CI run.
    return True, trigger_sha, f"no verified commit in the last {len(commits)}; deploying the trigger {trigger_sha[:7]}"


def _get(url: str, token: str):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}",
                                               "Accept": "application/vnd.github+json",
                                               "X-GitHub-Api-Version": "2022-11-28"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.load(resp)


def github_lookup(repo: str, branch: str, workflow: str, token: str):
    """(commits newest first, ci_run(sha)). Runs are asked for per commit (head_sha=): the list
    endpoint sorted by time returned week-old runs on one call and today's on the next (2026-10-04)."""
    api = f"https://api.github.com/repos/{repo}"
    commits = [c["sha"] for c in _get(f"{api}/commits?sha={branch}&per_page={WINDOW}", token)]
    path = f".github/workflows/{workflow}"

    def ci_run(sha: str) -> Optional[Tuple[str, Optional[str]]]:
        data = _get(f"{api}/actions/runs?head_sha={sha}&event=push&per_page=50", token)
        mine = [r for r in data.get("workflow_runs", [])
                if r.get("path", "").split("@")[0] == path and r.get("head_branch") == branch]
        if not mine:
            return None
        latest = max(mine, key=lambda r: (r.get("run_started_at") or r.get("created_at") or "", r.get("run_attempt") or 0))
        return latest["status"], latest.get("conclusion")

    return commits, ci_run


def self_test() -> None:
    a, b, c, d = ("a" * 40, "b" * 40, "c" * 40, "d" * 40)  # newest first: a, b, c, d
    ok, fail, running = ("completed", "success"), ("completed", "failure"), ("in_progress", None)

    def runs(table):
        return table.get

    assert pick([a, b], runs({a: ok, b: ok}), b) == (True, a, "newest commit that passed CI is aaaaaaa")
    # 2026-10-04: the tip's deploy was cancelled; the older trigger's run must still ship the tip
    assert pick([a, b, c], runs({a: ok, b: ok, c: ok}), c)[:2] == (True, a)
    assert pick([a, b], runs({a: running, b: ok}), b)[:2] == (False, a)      # newer still in CI
    assert pick([a, b], runs({a: fail, b: ok}), b)[:2] == (True, b)          # a failed tip never ships
    assert pick([a, b, c], runs({b: ok, c: ok}), c)[:2] == (True, b)         # a: docs-only, no CI run
    assert pick([a, b], runs({a: ("completed", "cancelled"), b: ok}), b)[:2] == (True, b)
    assert pick([a, d], runs({}), d)[:2] == (True, d)                        # nothing verified in window
    print("self-test ok")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--repo")
    ap.add_argument("--branch")
    ap.add_argument("--ci-workflow")
    ap.add_argument("--trigger-sha")
    args = ap.parse_args()
    if args.self_test:
        self_test()
        return 0
    if not SHA_RE.match(args.trigger_sha or ""):
        print(f"invalid trigger sha {args.trigger_sha!r}", file=sys.stderr)
        return 2
    commits, ci_run = github_lookup(args.repo, args.branch, args.ci_workflow, os.environ["GITHUB_TOKEN"])
    deploy, sha, reason = pick(commits, ci_run, args.trigger_sha)
    if not SHA_RE.match(sha):
        print(f"refusing a malformed sha {sha!r}", file=sys.stderr)
        return 2
    print(f"deploy={'true' if deploy else 'false'}")
    print(f"sha={sha}")
    print(f"reason={reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
