# Database backups

Founder decision F14 (2026-10-27): instead of the Supabase Pro plan, a free nightly backup runs on GitHub Actions (`.github/workflows/db-backup.yml`).

## What it does

- 01:41 UTC daily (and on demand from the Actions tab), `pg_dump` 17 dumps the whole database in custom format.
- The dump is streamed straight into `gpg` (AES-256, passphrase from `BACKUP_PASSPHRASE`); no plaintext file is written.
- The encrypted file is kept as a workflow artifact for 30 days. The repository is public, so treat the artifact as public too: its safety rests entirely on the passphrase.
- Database rows only. Storage files (portfolio photos) are not in the dump; their bucket metadata is.

## One-time setup

1. Generate a passphrase of at least 32 random characters in the password manager and save it there as "Privelier backup passphrase".
2. Copy the session pooler connection string: Supabase > Project Settings > Database > Connection string > Session pooler (port 5432), with the database password filled in.
3. Store both as repository secrets without putting them on a command line (each command asks for the value):

   ```bash
   gh secret set SUPABASE_DB_URL
   gh secret set BACKUP_PASSPHRASE
   ```

4. Run it once: `gh workflow run db-backup.yml`, then `gh run watch`. The log ends with "Encrypted dump: N bytes".

Rotate the database password? Update `SUPABASE_DB_URL` the same day, or the next backup fails.

## Restore drill (do it once before launch, then after major schema changes)

1. Create a scratch Supabase project (free tier) and copy its session pooler URI.
2. Download the newest artifact: `gh run download --name privelier-db-<stamp>`.
3. Decrypt (asks for the passphrase): `gpg --output privelier.dump --decrypt privelier-<stamp>.dump.gpg`
4. Restore the app schemas and the auth users into the scratch project:

   ```bash
   pg_restore --no-owner --no-privileges --dbname "<scratch session pooler URI>" \
     --schema=public --schema=private privelier.dump
   pg_restore --no-owner --no-privileges --data-only --dbname "<scratch session pooler URI>" \
     --table=users --schema=auth privelier.dump
   ```

   Errors about objects that Supabase already creates (extensions, `auth` and `storage` internals) are expected; errors in `public` or `private` are not.
5. Spot-check in the scratch project's SQL editor: `select count(*) from public.bookings;` and `select count(*) from auth.users;` match production.
6. Delete the scratch project and the local `privelier.dump` file.

A real production restore follows the same steps against the production project, after pausing writes.
