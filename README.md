# winampify.exe

A Windows 98 desktop with a Windows Media Player–style music player — for **your own music library**.
Pick your service when you sign in: a self-hosted [Navidrome](https://www.navidrome.org/) server
(through the OpenSubsonic API) or Spotify.

```
Win98 player (React) ──► Express proxy (/api/nd) ──► OpenSubsonic API ──► Navidrome ──► your library
```

## Features

- **Select your music service** — a Win98 logon-style picker for Navidrome or Spotify, remembered per browser
  (switch any time from Start → Log Off or Start → Settings → Music Service…)
- **Windows 98 desktop** — draggable, maximizable windows, taskbar with a working clock and volume tray,
  Start menu, desktop icons, right-click / long-press menus, Run… and Shut Down… dialogs
- **Display Properties** — pick a wallpaper (5 built-in pixel-art wallpapers or your own picture, shown
  centered, tiled or stretched) and a color scheme. Right-click the desktop → Properties, or Start → Settings
- **Disky, your (mostly) helpful assistant** — an original CD mascot with a first-visit tour, one-time tips,
  naps when you're idle, and a few easter eggs. He also reads your sticky notes (locally): write "dentist 3pm"
  and he'll offer a reminder, and he cheers when every `[ ]` on a checklist becomes `[x]`. Reminders pop up
  while Winampify is open. Hide him from his menu; Start → Help → Show Disky brings him back
- **Sticky notes** on the desktop — four colors, collapse to the title bar, and a Recycle Bin to restore
  deleted notes (right-click or long-press the desktop → New Sticky Note)
- **Media Library** — artists, albums, playlists, Liked Songs (Navidrome favorites),
  Recently Added and Recently Played
- **Search** across songs, albums and artists
- **Playback in the browser** — original files are streamed as-is (M4A/AAC, MP3, FLAC… whatever your browser
  supports); anything it can't decode automatically falls back to an MP3 transcode
- **Queue controls** — play/pause, stop, previous/next, ±10 s, seek, volume, mute, shuffle, repeat all/one,
  lock-screen and hardware media keys
- **Scrobbling** to Navidrome, and the queue and position survive a page refresh
- **WMP 7-style visualizations**: classic Bars and Waves, Scope and Dots plus the full MilkDrop library (butterchurn), with Random, Auto-change and full screen. On desktop with Navidrome they react to the actual music; elsewhere a simulated signal drives them
- **Windows XP skin**: switch between Windows 98 Classic and an XP-style look (Blue, Olive Green or Silver) in Display Properties → Appearance, with an XP Start menu, WMP 9-style player, Welcome screen and its own wallpaper. Your choice is remembered in this browser
- **Graphic Equalizer**: 10 bands (31 Hz–16 kHz, ±12 dB) with presets, from View → Graphic Equalizer or the EQ button (Navidrome on a computer)
- **Phone layout** — full-screen player, view tabs, drill-down library and 44 px touch targets

## Requirements

- Node.js 18 or newer
- A Navidrome server (tested with 0.64) that the machine running Winampify can reach

## Quick start

```bash
git clone https://github.com/UribeJr/winampify-exe.git
cd winampify-exe
npm install
cp .env.example .env    # then fill in your Navidrome URL, username and password
npm run dev
```

Open <http://localhost:3000>. After the boot screen, choose your music service; Navidrome connects and
opens the player, Spotify sends you to Spotify to sign in. Services that aren't configured in `.env` are
shown greyed out.

## Configuration

All settings live in `.env` (gitignored) and are read **only by the Express server** — nothing is bundled into
the browser. See [`.env.example`](.env.example).

| Variable | Required | Description |
| --- | --- | --- |
| `NAVIDROME_URL` | yes | Base URL of your Navidrome server, e.g. `http://your-navidrome-host:4533` |
| `NAVIDROME_USERNAME` | yes | Navidrome user |
| `NAVIDROME_PASSWORD` | yes | Navidrome password |
| `NAVIDROME_NAME` | no | Server name shown in the UI ("Connect to …"). Default `Navidrome` |
| `NAVIDROME_CLIENT_ID` | no | Player name Navidrome shows under Players. Default `winampify` |
| `MUSIC_PROVIDER` | no | Service pre-selected on the sign-in picker: `navidrome` (default) or `spotify` |
| `PORT` | no | API server port. Default `3001` |
| `HOST` | no | Interface the API server listens on. Default: this computer only (localhost) in development |

## Security model

- **Credentials never reach the browser.** The server signs each upstream request with Subsonic token auth
  (a fresh random salt `s` and `t = md5(password + s)`); JSON calls use the OpenSubsonic `formPost`
  extension so tokens stay out of URLs and logs.
- **Allowlisted proxy.** The browser can only call the routes in [`server/navidrome.js`](server/navidrome.js)
  (search, browse, favorites, scrobble, stream and cover art) with validated ids and clamped sizes. The
  upstream host is fixed by `NAVIDROME_URL`, so the proxy can't be pointed anywhere else.
- **Streams and artwork are proxied** too (with HTTP Range support for seeking), so no tokens appear in
  `<audio>` or `<img>` URLs.
- **Localhost by default.** In development the API only accepts connections from the same computer.

> **⚠️ Don't expose this server to the internet as-is.** Whoever can reach the Express server can play your
> library — it has no login of its own. To use it from a phone on your home network, set `HOST=0.0.0.0` and run
> `npm run client -- --host`; everyone on that network will have access.

## Using it on a phone

Navidrome playback is plain HTML5 audio, so it works in mobile browsers too. Under 767 px wide (or on short
touch screens) the player opens full-screen, the menu bar and toolbar become a row of view tabs, the library
becomes a drill-down list, and the transport controls get bigger. iOS doesn't let web pages change volume, so
the slider is disabled there — use the hardware buttons.

## Spotify (optional)

To offer Spotify on the sign-in picker, fill in the Spotify section of `.env.example`:

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add `http://127.0.0.1:3000/callback` as a Redirect URI. Spotify requires this exact loopback form (it rejects `localhost`), and it's the same on every computer.
3. Set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REDIRECT_URI` in `.env`.

Spotify playback requires **Spotify Premium**. Desktop browsers play through the Web Playback SDK; phones can't
run the SDK, so Winampify acts as a **Spotify Connect remote** for the Spotify app or a speaker. Search, artists
and favorites are Navidrome-only and are hidden while you're signed in to Spotify.

## Share it with friends (Vercel + Spotify)

You can host a **Spotify-only** copy for people you invite, while your personal copy keeps running at home
with Navidrome. It's the same code; the hosted copy simply never gets any Navidrome settings, so Navidrome is
hidden there and nothing can reach your music server.

1. **Create a Vercel project** from this repo (framework: Vite; `vercel.json` already routes the API to
   `api/index.js`). `main` is the shared site; other branches get private preview links.
2. **Set these environment variables** in the Vercel project (Production, and Preview with the preview URL):

   | Variable | Value |
   |---|---|
   | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | From your Spotify app |
   | `SPOTIFY_REDIRECT_URI` | `https://<your-site>/callback` |
   | `FRONTEND_URL`, `CLIENT_ORIGIN` | `https://<your-site>` |
   | `MUSIC_PROVIDER` | `spotify` |

   **Never add `NAVIDROME_*` variables to a hosted site** — that would put your library on the internet,
   and the app has no login of its own.
3. **In the Spotify Developer Dashboard**, add `https://<your-site>/callback` as a Redirect URI, then add each
   friend (name + Spotify email) under **User Management**. Apps in development mode allow up to 25 people;
   anyone else who signs in is told the site is invite-only.

Friends need Spotify Premium to play in the browser (on phones, Winampify controls their Spotify app instead).
The equalizer and real-audio visualizer need audio the browser can process, so they're Navidrome-only.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API server (port 3001) + Vite dev server (port 3000) |
| `npm test` | Proxy and normalizer tests (Node's built-in test runner, no extra dependencies) |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve `dist/` and the API from Express (`NODE_ENV=production`) |

## Project structure

```
app.js                 Express app: /api/config, Spotify OAuth + proxy, Navidrome proxy, static files (self-hosted)
server.js              Local / self-hosted entry point (app.listen)
api/index.js           Vercel function wrapping app.js (see vercel.json)
server/navidrome.js    Allowlisted Navidrome / OpenSubsonic proxy (token auth, streaming, cover art)
src/
  App.jsx              Boot screen, desktop shell wiring, dialogs
  os/                  Window manager, Window, Taskbar, Start menu, Desktop, context menu, app registry
  player/              Media player: views, track table, search, control bar, seek bar, visualizer
  music/               Provider layer: app models, MusicContext, Navidrome library + <audio> engine
  spotify/             Spotify backend: OAuth, API client, Web Playback SDK and Connect engines
  dialogs/             Run, Shut Down, Themes, sign-in and message dialogs
  styles/              base, shell, player and mobile CSS
test/                  Normalizer tests
```

Adding another music backend means implementing the library surface in `src/music/navidrome/library.js`
and providing the same `MusicContext` value as `NavidromeBackend.jsx`.

## Credits

- [98.css](https://jdan.github.io/98.css/) for the Windows 98 widgets
- [butterchurn](https://github.com/jberg/butterchurn) for the MilkDrop visualizer
- [XP.css](https://github.com/botoxparty/XP.css) for the Windows XP skin's controls (loaded only when that skin is chosen)
- [Navidrome](https://www.navidrome.org/) and the [OpenSubsonic API](https://opensubsonic.netlify.app/)

## License

[MIT](LICENSE)

Winampify is a fan project and isn't affiliated with or endorsed by Microsoft, Navidrome or Spotify.
Windows and Windows Media Player are trademarks of Microsoft Corporation; Spotify is a trademark of Spotify AB.
