# tiltseed

Tilt the glass (or drag a virtual horizon). Hash the trail. Get a Solana-ish address out.

Live: **https://robertkodes.github.io/tiltseed/**

Sibling to [micseed](https://github.com/RobertKodes/micseed) (hearing), [camseed](https://github.com/RobertKodes/camseed) (light), and [drawseed](https://github.com/RobertKodes/drawseed) (ink). Orientation is the input. Not a wallet, not an explorer, not a fee/slot costume.

## Design thesis

The case is walnut. The glass is a gyro.
Sky over earth — a spirit level that remembers the path you took.
Hold the bezel; the trail becomes a callsign stamped on brass.
No Inter, no purple, no cards, no hero: tilt, hold, take a seed.

Type: **Newsreader** (instrument face) + **IBM Plex Mono** (callsign). Fallbacks are Palatino / Courier New.

| token | hex | job |
| --- | --- | --- |
| `case` | `#14110d` | walnut field |
| `sky` | `#3d6a78` | attitude sky |
| `earth` | `#7a4e2e` | attitude earth |
| `brass` | `#d4b46a` | bezel / accent |
| `bubble` | `#c5edd4` | spirit-level fluid |
| `ivory` | `#f0e6d2` | warm ink |
| `soot` | `#9a8b72` | mute labels |

## How it works

1. **Desktop:** drag the virtual horizon (or nudge with arrow keys). Pitch and roll follow the pointer. No phone, no IMU required.
2. **Mobile:** tap **enable sensors** / **use device tilt**. iOS needs that gesture for `DeviceOrientationEvent.requestPermission` (and motion, when the browser asks). Then tilt the glass. **Use drag instead** returns to the virtual horizon.
3. **Hold** the bezel (pointer, touch, or space). That samples α / β / γ (and acceleration when the gyro reports it) for up to two seconds.
4. The trail is resampled to **48 poses**, quantized to 0.1° / 0.01 m/s², prefixed with a `tiltseed` domain, then **SHA-256** (Web Crypto). Tempo does not change the hash — the path does.
5. The 32-byte digest is **base58**-encoded (Solana alphabet). That string is 32–44 chars — a PDA-*looking* preview, not `findProgramAddress` with a program id.
6. Copy the callsign. **Again** clears the plate.

Denied sensors or an insecure context: drag still works. No wallet, no signing, no RPC.

This is a *preview* seed from the tilt. It is not a real program-derived PDA. Do not send funds to a wobble.

## Local

```bash
npm i
npm run dev
```

The app is built at `/tiltseed/` (GitHub Pages project path). Production check:

```bash
npm run build && npm run preview
```

Tests (hash + base58 + trail stability):

```bash
npm test
```

## Pages

`vite.config.ts` sets `base: '/tiltseed/'`. Push to `main` runs `.github/workflows/pages.yml`, which builds and force-pushes `dist/` (plus `.nojekyll`) to the `gh-pages` branch via `peaceiris/actions-gh-pages`.

Manual republish:

```bash
npm run pages
```

If https://robertkodes.github.io/tiltseed/ 404s, flip **Settings → Pages → Deploy from a branch → `gh-pages` / `/` (root)** once. Same source as micseed, camseed, and drawseed.
