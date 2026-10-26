#!/usr/bin/env bash
# Adds a gitleaks scan of staged changes to .git/hooks/pre-commit without
# replacing existing hook content. A commit that adds a secret is refused.
# Needs gitleaks on PATH (https://github.com/gitleaks/gitleaks#installing).
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
hook="$root/.git/hooks/pre-commit"
marker="# privelier-gitleaks"
if [[ -f "$hook" ]] && grep -Fq "$marker" "$hook"; then
  echo "gitleaks pre-commit hook already installed"
  exit 0
fi
if [[ ! -f "$hook" ]]; then
  printf '#!/usr/bin/env bash\n' > "$hook"
else
  [[ "$(tail -c 1 "$hook" | wc -l)" -gt 0 ]] || printf '\n' >> "$hook"
fi
cat >> "$hook" <<'HOOK'
# privelier-gitleaks
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks git --pre-commit --staged --redact --no-banner "$(git rev-parse --show-toplevel)" || {
    echo "gitleaks found a secret in the staged changes. Remove it; if it was real, rotate it." >&2
    exit 1
  }
else
  echo "warning: gitleaks is not installed; staged changes were not scanned for secrets" >&2
fi
HOOK
chmod +x "$hook"
echo "installed gitleaks pre-commit hook without replacing existing hook content"
