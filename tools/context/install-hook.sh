#!/usr/bin/env bash
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
hook="$root/.git/hooks/post-commit"
marker="# privelier-context-update"
if [[ -f "$hook" ]] && grep -Fq "$marker" "$hook"; then
  echo "context post-commit hook already installed"
  exit 0
fi
if [[ ! -f "$hook" ]]; then
  printf '#!/usr/bin/env bash\n' > "$hook"
else
  shebang="$(head -n 1 "$hook")"
  if [[ "$shebang" != *"sh"* && "$shebang" != *"bash"* ]]; then
    echo "existing post-commit hook is not a shell script; chain npm run context:update manually" >&2
    exit 1
  fi
  [[ "$(tail -c 1 "$hook" | wc -l)" -gt 0 ]] || printf '\n' >> "$hook"
fi
cat >> "$hook" <<'HOOK'
# privelier-context-update
(cd "$(git rev-parse --show-toplevel)" && npm run context:update >/dev/null 2>&1) ||
echo "warning: context graph update failed; run npm run context:update" >&2
HOOK
chmod +x "$hook"
echo "installed context updater without replacing existing hook content"
