"""One-time setup for the nightly barber-stats workflow. Run it YOURSELF:

    py tools/automation/setup_github_secrets.py

It reads your Supabase personal access token from SUPABASE_ACCESS_TOKEN,
asks the Supabase Management API for this project's secret key (the new
`sb_secret_` key; the legacy service_role JWT only as a fallback), and
pipes it straight into `gh secret set` over stdin. The key is never printed,
logged, written to disk or passed on a command line. Then it triggers the
workflow once so you can watch the first run.

Requires: gh logged in with access to the repo, SUPABASE_ACCESS_TOKEN set.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def main() -> int:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        sys.exit("SUPABASE_ACCESS_TOKEN is not set.")
    env = (REPO / ".env").read_text(encoding="utf-8")
    match = re.search(r"https://([a-z0-9]+)\.supabase\.co", env)
    if not match:
        sys.exit("Could not find the project URL in .env.")
    ref = match.group(1)

    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/api-keys?reveal=true",
        headers={"Authorization": f"Bearer {token}", "User-Agent": "privelier-setup/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        keys = json.loads(response.read())
    # Prefer the new secret key: the legacy service_role key is disabled in F5.
    secret = next((k.get("api_key") for k in keys if k.get("type") == "secret" and k.get("api_key")), None)
    secret = secret or next((k.get("api_key") for k in keys if k.get("name") == "service_role"), None)
    if not secret:
        sys.exit("No secret key returned for this project (Project Settings > API Keys > create a secret key).")

    for name, value in (("SUPABASE_URL", f"https://{ref}.supabase.co"), ("SUPABASE_SECRET_KEY", secret)):
        result = subprocess.run(["gh", "secret", "set", name, "--body", "-"], input=value, text=True, capture_output=True, cwd=REPO)
        if result.returncode != 0:
            sys.exit(f"gh secret set {name} failed: {result.stderr.strip()}")
        print(f"set {name}")

    # The old secret name is no longer read by the workflow.
    subprocess.run(["gh", "secret", "delete", "SUPABASE_SERVICE_ROLE_KEY"], cwd=REPO, capture_output=True, check=False)
    subprocess.run(["gh", "workflow", "run", "barber-stats.yml"], cwd=REPO, check=False)
    print("Triggered 'Barber stats'. Watch it with: gh run watch")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
