#!/usr/bin/env node
// Expo Go helper: checks a running `expo start --go --lan` server, pre-builds
// the iOS bundle (so bundling errors show up here, not on the phone), then
// prints the exp:// URL and opens a QR code the iPhone camera can scan.
//
// Usage (from the repo root, after the server is up):
//   node .claude/skills/run-privelier/expo-go.mjs [port=8081] [--no-open]
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../../package.json'));
const QRCode = require('qrcode'); // already a project dependency

const args = process.argv.slice(2);
const port = Number(args.find((a) => /^\d+$/.test(a)) ?? 8081);
const open = !args.includes('--no-open');

// The phone needs the Wi-Fi address, not a virtual adapter (WSL, Hyper-V, VPN).
const candidates = Object.entries(networkInterfaces())
  .filter(([name]) => !/vethernet|wsl|virtual|vmware|loopback|bluetooth/i.test(name))
  .flatMap(([, addrs]) => addrs ?? [])
  .filter((a) => a.family === 'IPv4' && !a.internal);
const ip = (candidates.find((a) => a.address.startsWith('192.168.')) ?? candidates[0])?.address;
if (!ip) throw new Error('no LAN IPv4 address found; is Wi-Fi connected?');

const base = `http://${ip}:${port}`;
const headers = { 'expo-platform': 'ios', accept: 'application/expo+json,application/json' };

let manifest;
for (let i = 0; i < 90 && !manifest; i++) {
  try {
    const res = await fetch(base, { headers, signal: AbortSignal.timeout(10_000) });
    if (res.ok) manifest = await res.json();
  } catch {}
  if (!manifest) await new Promise((r) => setTimeout(r, 2000));
}
if (!manifest) throw new Error(`no Expo manifest at ${base} after 3 min; is \`expo start --go --lan --port ${port}\` running?`);
console.log(`manifest ok: ${manifest.extra?.expoClient?.name} (${manifest.runtimeVersion})`);

const started = Date.now();
// A cold build is ~1 min; a server started before node_modules changed can
// wedge here instead, so give up after 5 min rather than hang forever.
const bundle = await fetch(manifest.launchAsset.url, { signal: AbortSignal.timeout(300_000) }).catch((e) => {
  console.error(`iOS bundle request failed (${e.name}); restart the server: expo start --go --lan --clear`);
  process.exit(1);
});
const body = await bundle.text();
if (!bundle.ok) {
  console.error(`iOS bundle FAILED (${bundle.status}):\n${body.slice(0, 2000)}`);
  process.exit(1);
}
console.log(`iOS bundle ok: ${(body.length / 1e6).toFixed(1)} MB in ${((Date.now() - started) / 1000).toFixed(1)}s`);

const url = `exp://${ip}:${port}`;
const png = join(here, 'out', 'expo-go-qr.png');
await QRCode.toFile(png, url, { width: 480, margin: 2 });
console.log(await QRCode.toString(url, { type: 'terminal', small: true }));
console.log(`Expo Go URL: ${url}`);
console.log(`QR image:    ${png}`);
if (open && process.platform === 'win32') spawn('cmd', ['/c', 'start', '', png], { detached: true, stdio: 'ignore' }).unref();
