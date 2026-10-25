# GoKart 🏎️

A Mario Kart–style party racer for the living room. The **TV browser is the screen**
and **phones on the same Wi-Fi are the controllers** — no app to install, no gamepads.

- Up to **8 racers**: friends on phones plus CPU drivers to fill the grid
- **Split screen** for every human player (1 → full screen, 2 → top/bottom, 3–4 → 2×2, up to 4×2),
  with a live minimap and standings
- **4 tracks**: Sunny Circuit, Dune Dash, Frosty Peaks, Neon Night
- **Drifting with mini-turbos** (blue → orange → pink sparks), boost pads, rocket starts
- **Items** from `?` boxes, weighted by position: banana, green shell, homing red shell,
  mushroom, triple mushroom, star and lightning
- 50cc / 100cc / 150cc, 1–7 laps, cup points that carry across races
- Hilly themed worlds with scenery, grandstand crowds, neon city skyline at night, sky with clouds and weather
- Particle effects: drift sparks, tyre smoke, dust, boost flames, item explosions, confetti
- Synthesized sound: engines with gear shifts, tyre screech, layered effects and an original soundtrack
  per track (speeds up on the final lap, switches to a star theme with star power)
- Phones vibrate when you get hit, grab an item or boost (Android)
- Drop-in reconnects: a phone or the TV can reload mid-race and pick up where it was

## Quick start

You need [Node.js](https://nodejs.org) 18+ on any computer on your home network
(laptop, desktop, Raspberry Pi…).

```bash
npm install
npm start
```

The server prints something like:

```
TV  : open  http://192.168.1.42:8080/   in the TV browser
Phone: open http://192.168.1.42:8080/play  (or scan the QR code on the TV)
```

1. Open the first address in your **TV's web browser** (or cast/HDMI a laptop to the TV).
2. Everyone **scans the QR code** on the TV with their phone (or types the address).
3. Enter a name, pick a driver, tap **Join race**.
4. The first phone to join is the **captain 👑** and picks track, laps, speed and CPU count,
   then hits **START!**

Use a different port with `PORT=3000 npm start`.

## Run with Docker

On your server, set `PUBLIC_URL` to the address phones will use to reach it. Inside a
container the server only sees Docker's internal IP, so without this the QR code on the
TV would point phones at an address they can't reach.

```bash
docker build -t gokart .
docker run -d --name gokart --restart unless-stopped \
  -p 8080:8080 -e PUBLIC_URL=http://192.168.1.42:8080 gokart
```

Or use Compose. It publishes the game on host port **8742** (8080 is usually taken on a
home server) and defaults `PUBLIC_URL` to `http://192.168.1.50:8742` (the Proxmox box).
To change either, put `GOKART_PORT=...` and/or `PUBLIC_URL=...` in a `.env` file next to
`docker-compose.yml`:

```bash
# first time
ssh root@192.168.1.50 'git clone https://github.com/gmaingret/gokart /root/gokart && cd /root/gokart && docker compose up -d --build'
# updates
ssh root@192.168.1.50 'cd /root/gokart && git pull && docker compose up -d --build'
```

The repo is private, so the clone needs the same GitHub credentials the box already uses
for `/root/chris`.

Then open `http://<server-ip>:<port>/` on the TV (`http://192.168.1.50:8742/` with Compose). If you put it behind a reverse proxy
(e.g. `https://gokart.example.com`), set `PUBLIC_URL` to that address and make sure the
proxy forwards WebSocket upgrades on `/ws`. Serving it over `https://` also makes tilt
steering work on iPhones.

## Phone controls

Hold the phone sideways.

| Control | What it does |
| --- | --- |
| Left pad | Slide your thumb left/right to steer (or switch to ◀ ▶ buttons or tilt in ⚙️) |
| **DRIFT** | Hold while steering into a corner. Keep it held to charge sparks; release for a boost |
| **ITEM** | Use your item. Hold **BRAKE** while tapping ITEM to throw shells backwards / bananas forwards |
| **BRAKE** | Brake, then reverse |
| **GAS** | Only shown if you turn off *Auto-accelerate* in ⚙️ |

Rocket start: with auto-accelerate off, press GAS during the last half of the "1" in the countdown.

Tilt steering needs motion-sensor access. iPhones only allow that on `https://` pages,
so on a plain-http home network use slide steering there.

## TV / keyboard controls

- TV remote in the lobby: ▲▼ choose a setting, ◀▶ change it, OK starts the race; OK on the results screen continues.
- **Graphics: Low** in the lobby setup trades effects and resolution for speed — use it if the TV browser stutters.
- **K** adds a keyboard racer (arrows/WASD, Space to drift, X to use an item) — handy for testing without phones.
- **Esc** ends the current race.

## How it works

```
 phone ──┐                      ┌── TV browser (three.js)
 phone ──┼── WebSocket relay ───┤   runs the whole simulation:
 phone ──┘   (server.js)        │   physics, AI, items, rendering
```

- `server.js` serves the pages and relays messages; it holds no game state. Each TV gets a
  4-letter room code; phones are routed to it and keep their slot through reconnects.
- The TV runs a fixed 60 Hz simulation and renders one viewport per human player.
- Phones send their stick/button state ~8× per second and on every change; the TV sends
  back place, lap and item so the phone shows them.

```
server.js              HTTP + WebSocket server, QR code endpoint
src/relay.js           room / player message relay
public/tv/             TV game (main loop, track builder, kart physics, items, AI, HUD, audio)
public/controller/     phone controller
public/shared/         data shared by both (drivers, items, points)
test/                  node:test unit tests
```

## Development

```bash
npm test          # relay + track geometry tests
```

All tracks are generated from a handful of control points in `public/tv/track.js`. Add a
new entry to `TRACKS` (and its name to `TRACK_NAMES` in `public/shared/config.js`); the tests
check that the new layout never overlaps itself.

## Troubleshooting

- **Phones can't load the page**: make sure they're on the same Wi-Fi as the computer
  running the server (not a guest network), and that the computer's firewall allows
  incoming connections on the port.
- **QR code shows the wrong address**: open the TV page with the computer's LAN address
  instead of `localhost`; the QR code then uses that address.
- **Several TVs on one server**: phones pick the room automatically if there is only one;
  otherwise they enter the 4-letter room code shown on the TV.
