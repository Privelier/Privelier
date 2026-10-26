"""Run SQL against the linked Supabase project through the Management API.

There is no local Docker stack on the founders' machines, so migrations and
database tests run against the project inside explicit transactions:

  python tools/db/supa.py sql < query.sql          one query, JSON rows out
  python tools/db/supa.py dry-run FILE...          apply files, then ROLLBACK
  python tools/db/supa.py apply FILE...            apply + record, COMMIT
  python tools/db/supa.py pending                  migration files not yet recorded
  python tools/db/supa.py test [FILE...]           run supabase/tests/*.sql
  python tools/db/supa.py types                    regenerate src/database.types.ts

Every test file opens with BEGIN and ends with ROLLBACK, so tests create
only synthetic rows that never commit. Needs SUPABASE_ACCESS_TOKEN (a
personal access token) in the environment; the project ref is read from
EXPO_PUBLIC_SUPABASE_URL in .env. Nothing secret is ever printed.
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "supabase" / "migrations"
TESTS = ROOT / "supabase" / "tests"


def project_ref() -> str:
    env = (ROOT / ".env").read_text(encoding="utf-8")
    match = re.search(r"EXPO_PUBLIC_SUPABASE_URL\s*=\s*\"?https://([a-z0-9]+)\.supabase", env)
    if not match:
        sys.exit("EXPO_PUBLIC_SUPABASE_URL not found in .env")
    return match.group(1)


def run(sql: str) -> list[dict]:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        sys.exit("SUPABASE_ACCESS_TOKEN is not set")
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{project_ref()}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "privelier-tools",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode(errors="replace")[:4000]) from None


def recorded_names() -> set[str]:
    rows = run("select version, name from supabase_migrations.schema_migrations")
    return {row["name"] for row in rows if row.get("name")} | {row["version"] for row in rows}


def is_recorded(file: pathlib.Path, names: set[str]) -> bool:
    # Early migrations were recorded without their numeric prefix, or under
    # their timestamp prefix as the version.
    prefix, _, rest = file.stem.partition("_")
    return file.stem in names or rest in names or prefix in names


def migration_files(paths: list[str]) -> list[pathlib.Path]:
    files = [pathlib.Path(p).resolve() for p in paths]
    for file in files:
        if not file.is_file():
            sys.exit(f"no such file: {file}")
    return files


def cmd_sql() -> None:
    print(json.dumps(run(sys.stdin.read()), indent=1, default=str))


def cmd_dry_run(paths: list[str]) -> None:
    # All files in one transaction, in order, exactly as they will apply.
    files = migration_files(paths)
    run("begin;\n" + "".join(test_body(f) + "\n;\n" for f in files) + "rollback;")
    for file in files:
        print(f"dry-run ok  {file.name}")


def cmd_apply(paths: list[str]) -> None:
    done = recorded_names()
    latest = int(run("select coalesce(max(version), '0') as v from supabase_migrations.schema_migrations")[0]["v"])
    for file in migration_files(paths):
        if is_recorded(file, done):
            print(f"skip       {file.name} (already recorded)")
            continue
        # Strictly increasing even when several files apply within one second.
        latest = max(int(datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")), latest + 1)
        version = str(latest)
        name = file.stem.replace("'", "''")
        run(
            f"begin;\n{file.read_text(encoding='utf-8')}\n;"
            f"insert into supabase_migrations.schema_migrations (version, name) values ('{version}', '{name}');"
            "commit;"
        )
        print(f"applied    {file.name} as {version}")


def cmd_pending() -> None:
    done = recorded_names()
    pending = [f.name for f in sorted(MIGRATIONS.glob("*.sql")) if not is_recorded(f, done)]
    print("\n".join(pending) if pending else "none")


TX_EDGE = re.compile(r"^\s*begin\s*;|rollback\s*;\s*$", re.IGNORECASE)


ASSERTION = re.compile(
    r"^select (\*\s+from\s+finish\(\)|(?:is|isnt|ok|throws_ok|lives_ok|results_eq|is_empty|isnt_empty)\()",
    re.IGNORECASE | re.MULTILINE,
)


def collect_tap(body: str) -> str:
    """Route every top-level pgTAP assertion into a temp log.

    The Management API returns only the last statement's rows, and pgTAP 1.3
    keeps no per-test record, so each assertion's TAP line is inserted into
    __tap_out and the whole log is returned at the end.
    """
    if not ASSERTION.search(body):
        return body
    routed = ASSERTION.sub(lambda m: "insert into __tap_out (line) select " + m.group(1), body)
    return (
        "create temp table __tap_out (n serial primary key, line text);\n"
        + routed
        + "\n;select string_agg(line, E'\\n' order by n) as tap from __tap_out;"
    )


INCLUDE = re.compile(r"^\\ir\s+(\S+)\s*$", re.MULTILINE)


def test_body(file: pathlib.Path) -> str:
    # psql's \ir (used by pg_prove / `supabase test db`) is inlined here.
    sql = INCLUDE.sub(
        lambda m: (file.parent / m.group(1)).read_text(encoding="utf-8"),
        file.read_text(encoding="utf-8"),
    )
    if re.search(r"\bcommit\b", re.sub(r"--[^\n]*", "", sql), re.IGNORECASE):
        sys.exit(f"{file.name}: tests must never COMMIT")
    return TX_EDGE.sub("", sql.strip())


def cmd_test(args: list[str]) -> None:
    # `test --with M1.sql M2.sql -- T1.sql` stages unapplied migrations inside
    # the same rolled-back transaction as each test file.
    staged: list[pathlib.Path] = []
    if args[:1] == ["--with"]:
        split = args.index("--") if "--" in args else len(args)
        staged, args = migration_files(args[1:split]), args[split + 1:]
    prelude = "".join(test_body(f) + "\n;\n" for f in staged)
    files = migration_files(args) if args else sorted(
        f for f in TESTS.glob("*.sql") if not f.name.startswith("_")
    )
    failures = 0
    for file in files:
        # No COMMIT anywhere: the API rolls back the open transaction when the
        # request ends, after the last statement (finish()) has returned.
        sql = (
            "begin;\n" + prelude
            + "create extension if not exists pgtap with schema extensions;\n"
            + "set local search_path = public, extensions;\n"
            + collect_tap(test_body(file))
        )
        try:
            rows = run(sql)
        except RuntimeError as error:
            failures += 1
            print(f"FAIL  {file.name}\n      {str(error)[:1500]}")
            continue
        # pgTAP files end with `select * from finish()`; plain contract files
        # raise on failure and return nothing.
        lines = [
            line
            for row in rows or []
            for line in str(next(iter(row.values())) or "").splitlines()
        ]
        bad = [line for line in lines if line.startswith(("not ok", "#"))]
        if bad:
            failures += 1
            print(f"FAIL  {file.name}")
            for line in bad:
                print(f"      {line}")
        else:
            passed = sum(1 for line in lines if line.startswith("ok"))
            print(f"ok    {file.name}" + (f" ({passed} assertions)" if passed else ""))
    print(f"\n{len(files) - failures}/{len(files)} files passed")
    if failures:
        sys.exit(1)


def cmd_types() -> None:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        sys.exit("SUPABASE_ACCESS_TOKEN is not set")
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{project_ref()}/types/typescript?included_schemas=public",
        headers={"Authorization": f"Bearer {token}", "User-Agent": "privelier-tools"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        types = json.load(response)["types"]
    out = ROOT / "src" / "database.types.ts"
    header = "// Generated from the live database schema: `npm run db:types`. Do not edit.\n"
    out.write_text(header + types, encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)}")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    command, args = sys.argv[1], sys.argv[2:]
    if command == "sql":
        cmd_sql()
    elif command == "dry-run":
        cmd_dry_run(args)
    elif command == "apply":
        cmd_apply(args)
    elif command == "pending":
        cmd_pending()
    elif command == "test":
        cmd_test(args)
    elif command == "types":
        cmd_types()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
