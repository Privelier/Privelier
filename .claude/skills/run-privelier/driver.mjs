#!/usr/bin/env node
// Privelier web driver: runs a sequence of steps against the Expo web build
// in the locally installed Chrome (playwright-core, channel "chrome" — no
// browser download). One invocation = one browser session; the Chrome
// profile persists in the OS temp dir so a Supabase login survives runs.
//
// Usage (from the repo root):
//   node .claude/skills/run-privelier/driver.mjs [--url http://localhost:8090] [--headed] [--fresh] STEP...
//
// Steps (each is a verb followed by its arguments):
//   goto <path|url>          navigate (path is relative to --url)
//   click <sel>              click an element
//   fill <sel> <value>       type into an input (replaces existing text)
//   press <key>              keyboard key, e.g. Enter, Tab
//   wait <ms|sel>            sleep N ms, or wait until a selector is visible
//   ss <name>                screenshot -> .claude/skills/run-privelier/out/<name>.png
//   text                     print the page's visible text
//   testids                  list the visible data-testid values (what you can click)
//   eval <js>                evaluate a JS expression in the page, print the result
//   logout                   clear localStorage (drops the Supabase session) and reload
//
// Selectors: "#foo" means [data-testid="foo"] (RN testID). Anything else is a
// Playwright selector: text=Log in, role=button[name="Log in"], css, etc.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'out');
// Outside the repo: Metro watches the project tree, and Chrome writes to its
// profile constantly.
const profileDir = join(tmpdir(), 'privelier-driver-profile');

const argv = process.argv.slice(2);
let baseUrl = process.env.PRIVELIER_URL ?? 'http://localhost:8090';
let headed = false;
while (argv[0]?.startsWith('--')) {
  const flag = argv.shift();
  if (flag === '--url') baseUrl = argv.shift();
  else if (flag === '--headed') headed = true;
  else if (flag === '--fresh') rmSync(profileDir, { recursive: true, force: true });
  else throw new Error(`unknown flag ${flag}`);
}

const ARITY = { goto: 1, click: 1, fill: 2, press: 1, wait: 1, ss: 1, text: 0, testids: 0, eval: 1, logout: 0, login: 1 };

// `login customer|barber` reads credentials from the gitignored .test-accounts.env
// so passwords never appear on the command line.
function testAccount(role) {
  const env = Object.fromEntries(
    readFileSync(join(here, '.test-accounts.env'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  );
  const email = env[`${role.toUpperCase()}_EMAIL`];
  const password = env[`${role.toUpperCase()}_PASSWORD`];
  if (!email || !password) throw new Error(`no ${role} login in .test-accounts.env`);
  return { email, password };
}
const steps = [];
while (argv.length) {
  const verb = argv.shift();
  if (!(verb in ARITY)) throw new Error(`unknown step "${verb}"`);
  steps.push([verb, ...argv.splice(0, ARITY[verb])]);
}
if (!steps.length) steps.push(['goto', '/'], ['wait', '#role-select-customer'], ['ss', 'home'], ['testids']);

const sel = (s) => (s.startsWith('#') ? `[data-testid="${s.slice(1)}"]` : s);

mkdirSync(outDir, { recursive: true });
const ctx = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless: !headed,
  viewport: { width: 390, height: 844 }, // phone-sized; the app is mobile-first
  deviceScaleFactor: 2,
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console.error: ${m.text().slice(0, 300)}`));

let exitCode = 0;
try {
  for (const [verb, a, b] of steps) {
    console.log(`> ${verb}${a !== undefined ? ' ' + a : ''}${b !== undefined ? ' ' + b : ''}`);
    switch (verb) {
      case 'goto':
        // Git Bash rewrites a bare "/" argument into C:/.../Git/ before node sees it.
        if (/^[A-Za-z]:[\\/]/.test(a)) throw new Error(`goto got a Windows path (${a}); in Git Bash prefix the command with MSYS_NO_PATHCONV=1`);
        await page.goto(a.startsWith('http') ? a : new URL(a, baseUrl).href, { waitUntil: 'load', timeout: 120_000 });
        break;
      case 'click':
        await page.locator(sel(a)).first().click({ timeout: 15_000 });
        break;
      case 'fill':
        await page.locator(sel(a)).first().fill(b, { timeout: 15_000 });
        break;
      case 'press':
        await page.keyboard.press(a);
        break;
      case 'wait':
        if (/^\d+$/.test(a)) await page.waitForTimeout(Number(a));
        else await page.locator(sel(a)).first().waitFor({ state: 'visible', timeout: 60_000 });
        break;
      case 'ss': {
        const file = join(outDir, `${a}.png`);
        await page.screenshot({ path: file });
        console.log(`  saved ${file}`);
        break;
      }
      case 'text':
        console.log(await page.locator('body').innerText());
        break;
      case 'testids': {
        const ids = await page.$$eval('[data-testid]', (els) =>
          els.filter((e) => e.offsetParent !== null || e.getClientRects().length).map((e) => e.dataset.testid),
        );
        console.log([...new Set(ids)].join('\n'));
        break;
      }
      case 'eval':
        console.log(JSON.stringify(await page.evaluate(a), null, 2));
        break;
      case 'login': {
        const { email, password } = testAccount(a);
        await page.goto(baseUrl, { waitUntil: 'load', timeout: 120_000 });
        await page.locator(sel(`#role-select-${a}`)).click({ timeout: 60_000 });
        await page.locator(sel('#auth-entry-login')).click({ timeout: 15_000 });
        await page.locator(sel('#auth-login-email')).fill(email);
        await page.locator(sel('#auth-login-password')).fill(password);
        await page.locator(sel('#auth-login-submit')).click();
        // Success unmounts the login form; an error notice means bad credentials.
        const ok = page.locator(sel('#auth-login-email')).waitFor({ state: 'detached', timeout: 30_000 }).then(() => 'ok');
        const bad = page.locator(sel('#auth-login-error')).waitFor({ timeout: 30_000 }).then(() => 'bad');
        ok.catch(() => {});
        bad.catch(() => {});
        if ((await Promise.any([ok, bad])) === 'bad') throw new Error(`${a} login rejected`);
        break;
      }
      case 'logout':
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'load' });
        break;
    }
  }
} catch (e) {
  exitCode = 1;
  console.error(`STEP FAILED: ${e.message.split('\n')[0]}`);
  const file = join(outDir, 'failure.png');
  await page.screenshot({ path: file }).catch(() => {});
  console.error(`  failure screenshot: ${file}`);
} finally {
  if (problems.length) console.log(`\n-- browser errors (${problems.length}) --\n${problems.slice(0, 20).join('\n')}`);
  await ctx.close();
  process.exit(exitCode);
}
