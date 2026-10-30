// Network + frame-rate monitor for the TV, shared by both games.
//
// Every 50 ms the TV pings each phone ({t:'k', ts, r}); the phone answers at
// once ({t:'ka', ts, tp}) with its own clock. The steady trickle of packets
// stops the TV's and phones' Wi-Fi from dozing in power-save mode, where
// incoming packets wait at the router for the next beacon (often ~100 ms).
//
// The fastest round trips give the offset between the two clocks (assuming
// that exchange was symmetric), which splits the lag into its two directions:
// ↑ phone → TV (what you feel when steering; measured on the actual input
// messages, which carry the phone's clock too) and ↓ TV → phone. The server
// also reports its own WebSocket ping to the TV and to each phone, which shows
// which leg of the trip (TV↔server or phone↔server) is slow.

const INTERVAL = 50;

export function createNetStat(sendTo, getPlayers) {
  const el = document.createElement('div');
  el.id = 'netstat';
  Object.assign(el.style, {
    position: 'fixed',
    left: '1vw',
    bottom: '1vh',
    padding: '0.3em 0.7em',
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    font: '600 clamp(11px, 1vw, 18px) system-ui, sans-serif',
    pointerEvents: 'none',
    zIndex: 20,
  });
  document.body.appendChild(el);

  let frames = 0, fpsT = 0, fps = 60, worst = 0;
  setInterval(() => {
    const ts = Math.round(performance.now());
    for (const p of getPlayers()) {
      if (!p.connected || p.kb) continue;
      sendTo(p.pid, { t: 'k', ts, r: p.rtt === undefined ? null : Math.round(p.rtt) });
    }
  }, INTERVAL);

  const color = (ms) => (ms < 40 ? '#7dff6e' : ms < 90 ? '#ffd84d' : '#ff6b6b');
  const ms = (v) => (v === undefined || v === null ? '…' : `<span style="color:${color(v)}">${Math.round(v)}</span>`);
  let tvLeg;
  function draw() {
    let head = `<span style="color:${fps >= 50 ? '#7dff6e' : fps >= 30 ? '#ffd84d' : '#ff6b6b'}">${fps} fps</span>`;
    if (worst > 70) head += ` <span style="opacity:.7">(${Math.round(worst)} ms hitch)</span>`;
    if (tvLeg !== undefined) head += ` · TV↔server ${ms(tvLeg)} ms`;
    const parts = [head];
    for (const p of getPlayers()) {
      if (!p.connected || p.kb) continue;
      const leg = p.srv !== undefined ? ` <span style="opacity:.7">(server ${Math.round(p.srv)})</span>` : '';
      parts.push(`${p.name.replace(/[<&]/g, '')} ↑${ms(p.up)} ↓${ms(p.down)} ms${leg}`);
    }
    el.innerHTML = '📶 ' + parts.join(' · ');
  }

  return {
    // A phone answered a ping.
    pong(p, m) {
      if (!p || typeof m.ts !== 'number') return;
      const now = performance.now();
      const rtt = Math.max(0, now - m.ts);
      p.rtt = p.rtt === undefined ? rtt : p.rtt * 0.85 + rtt * 0.15;
      if (typeof m.tp !== 'number') return;
      // The quickest exchange (slowly forgotten) fixes the clock offset.
      p.bestRtt = Math.min((p.bestRtt ?? Infinity) * 1.002 + 0.02, rtt);
      if (rtt <= p.bestRtt) p.offset = m.tp - (m.ts + rtt / 2);
      const down = m.tp - p.offset - m.ts;
      p.down = p.down === undefined ? down : p.down * 0.85 + down * 0.15;
      if (p.upAt === undefined || now - p.upAt > 500) {
        // No input messages lately: take the uplink from the ping reply.
        const up = now - (m.tp - p.offset);
        p.up = p.up === undefined ? up : p.up * 0.85 + up * 0.15;
      }
    },
    // An input message stamped with the phone's clock (`tp`) arrived.
    input(p, tp) {
      if (!p || typeof tp !== 'number' || p.offset === undefined) return;
      const now = performance.now();
      const up = Math.max(0, now - (tp - p.offset));
      p.up = p.up === undefined ? up : p.up * 0.9 + up * 0.1;
      p.upAt = now;
    },
    // The server's own WebSocket ping times ({t:'lat', tv, p: {pid: ms}}).
    server(m, players) {
      tvLeg = m.tv;
      for (const [pid, v] of Object.entries(m.p || {})) {
        const p = players.get(Number(pid));
        if (p) p.srv = v;
      }
    },
    // Call once per rendered frame with its duration in seconds.
    frame(dt) {
      frames++;
      fpsT += dt;
      worst = Math.max(worst * 0.995, dt * 1000);
      if (fpsT >= 0.5) {
        fps = Math.round(frames / fpsT);
        frames = 0;
        fpsT = 0;
        draw();
      }
    },
  };
}
