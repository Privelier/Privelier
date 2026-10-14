---
name: run-privelier
description: Run, start, launch, open, screenshot or drive the Privelier Expo app. Use when asked to "open the app in Expo Go", "show me the app on my iPhone", run the web build, take a screenshot, click through a flow, or confirm a change works in the real app (not just tests).
---

# Run Privelier

One Expo SDK 57 / React Native app (Customer + Barber experiences, one Supabase
backend). Windows host, Git Bash. There is **no Android AVD and no iOS
simulator** on this machine, so there are two real surfaces:

- **Expo Go on the founder's iPhone** — the founder's normal way to see the app.
  You start the server and hand them a QR code; they only open Expo Go.
- **Web build driven by `driver.mjs`** — your own way to click through flows
  and take screenshots (Playwright + the installed Chrome, no browser download).

All paths below are relative to the repo root.

## Prerequisites (once)

```bash
npm ci
npm install --prefix .claude/skills/run-privelier --no-audit --no-fund   # playwright-core for driver.mjs
```

`.env` must exist (copy of `.env.example` with the real public values).

## "Open the app in Expo" (founder path — do all of it yourself)

1. If something already listens on 8081, check it is healthy first:
   `curl -s -m 10 -o /dev/null -w "%{http_code}\n" -H "expo-platform: ios" http://localhost:8081/`
   - `200` → reuse it, skip to step 3.
   - `000`/timeout → it is wedged; stop it (PowerShell:
     `Stop-Process -Id (Get-NetTCPConnection -LocalPort 8081 -State Listen).OwningProcess -Force`).
2. Start the server in the background (Bash tool, `run_in_background: true`).
   Use **production mode** — the founder judges speed on this, and the default
   development bundle (React debug checks, unminified) feels far slower than
   the real app:
   ```bash
   npx expo start --go --lan --port 8081 --no-dev --minify
   ```
   Add `--clear` after `node_modules` changes. Drop `--no-dev --minify` only
   when someone needs fast refresh or dev error overlays while coding.
3. Run the helper — waits for the server, pre-builds the iOS bundle (bundling
   errors surface here, not on the phone), prints the `exp://` URL and opens a
   QR image on the founder's screen:
   ```bash
   node .claude/skills/run-privelier/expo-go.mjs 8081
   ```
   Expected: `manifest ok: Privelier (exposdk:57.0.0)`, `iOS bundle ok: 11.0 MB`
   (production; a development server reports ~13.9 MB), and
   `Expo Go URL: exp://192.168.1.30:8081`.
4. Tell the founder to scan the QR with the iPhone camera, which hands the
   `exp://` link to Expo Go. Phone and PC must be on the same Wi-Fi.

Leave the server running; Metro hot-reloads edits onto the phone.

## Drive the web build (agent path)

Start the web server in the background (port 8090 so it never fights the
founder's 8081 Expo Go server):

```bash
BROWSER=none npx expo start --web --port 8090
```

Wait until `curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/` is
`200`, then drive it. **Prefix with `MSYS_NO_PATHCONV=1`** (see Gotchas):

```bash
MSYS_NO_PATHCONV=1 node .claude/skills/run-privelier/driver.mjs \
  goto / click '#role-select-customer' wait '#auth-entry-login' \
  click '#auth-entry-login' wait '#auth-login-email' \
  fill '#auth-login-email' nobody@example.invalid \
  fill '#auth-login-password' wrong-password-123 \
  click '#auth-login-submit' wait '#auth-login-error' ss login-error \
  eval "document.querySelector('[data-testid=auth-login-error]').innerText"
```

Prints `"Incorrect email or password."` (a real round-trip to Supabase) and
saves `.claude/skills/run-privelier/out/login-error.png`. With no steps the
driver opens the role-select screen, screenshots it, and lists its testIDs.

Steps: `goto <path>`, `click <sel>`, `fill <sel> <text>`, `press <key>`,
`wait <ms|sel>`, `ss <name>`, `text`, `testids`, `eval <js>`, `logout`.
`#foo` = `[data-testid="foo"]` (RN `testID` → `data-testid` on web); anything
else is a Playwright selector (`text=Log in`). Flags: `--url`, `--headed`,
`--fresh` (wipe the persisted Chrome profile / Supabase session). Read the
screenshots — a blank dark PNG means the React tree crashed; the driver prints
`pageerror:` lines for that.

To get past login, `login customer` or `login barber` reads the test account
from the gitignored `.claude/skills/run-privelier/.test-accounts.env`
(`CUSTOMER_EMAIL=`, `CUSTOMER_PASSWORD=`, `BARBER_EMAIL=`, `BARBER_PASSWORD=`),
so passwords never appear in commands or chat. Run `logout` (or `--fresh`)
before switching roles. Do not create accounts on the shared Supabase project
just to test.

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx jest            # ~30 s, 105 suites
```

## Gotchas

- **Git Bash rewrites a bare `/` argument** into `C:/Users/.../Git/`, so
  `driver.mjs goto /` navigated to a file path and every later step timed out.
  Always prefix with `MSYS_NO_PATHCONV=1`; the driver refuses Windows paths.
- **Port 8081 is usually taken** by the founder's own Expo Go server. A second
  `expo start` without `--port` exits in non-interactive mode
  (`Input is required ... Use port 8082 instead?`). Use 8090 for web.
- **Non-TTY `expo start` prints no QR code or `exp://` URL** — that is why
  `expo-go.mjs` exists. The manifest's bundle URL echoes the host you asked
  with, so the helper queries the LAN IP (`192.168.x`), never `localhost`.
- **A server started before `node_modules` changed** (npm install/uninstall)
  can serve the manifest but hang forever building the bundle at 1+ GB RAM.
  Restart it with `--clear`.
- **`CI=1` disables Metro reloads** — edits are not picked up until restart.
  Leave `CI` unset; the ⚡ button bottom-left in web screenshots is Expo's dev
  overlay, not app UI.
- **Web is a preview, not a target**: native-only modules (Mapbox, Secure Store,
  image picker, Apple sign-in) do not work there. A web-only console error
  "Received `false` for a non-boolean attribute `accessible`" comes from
  decorative SVGs and is harmless.
- `AccessibilityInfo.isReduceTransparencyEnabled` does not exist on
  react-native-web; calling it blanked the whole app after the first screen.
  `src/shared/motion/useReduceTransparency.ts` now skips it on web.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `STEP FAILED: locator.click: Timeout` right after `goto` | Missing `MSYS_NO_PATHCONV=1`; check the `> goto` line shows `/`. |
| Screenshot is solid dark, `pageerror:` printed | A render crash on web; fix the thrown API (see Gotchas). |
| `expo-go.mjs` stops at `iOS bundle request failed` | Server wedged; stop the 8081 process, restart with `--clear`. |
| `Cannot find package 'playwright-core'` | Run the second Prerequisites command. |
| Phone cannot reach `exp://192.168.x.x:8081` | Same Wi-Fi? Windows network profile must be Private and Node allowed through the firewall. |
