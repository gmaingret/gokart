// Network + frame-rate monitor for the TV, shared by both games.
//
// Every 50 ms the TV pings each phone ({t:'k', ts, r}); the phone answers at
// once ({t:'ka', ts}). That measures the round trip through Wi-Fi and the
// server, and the steady trickle of packets also stops the TV's and phones'
// Wi-Fi from dozing in power-save mode, where incoming packets wait at the
// router for the next beacon (often ~100 ms). A small corner readout shows
// fps and each phone's ping so a laggy setup can be diagnosed at a glance.

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
  function draw() {
    const parts = [`<span style="color:${fps >= 50 ? '#7dff6e' : fps >= 30 ? '#ffd84d' : '#ff6b6b'}">${fps} fps</span>`];
    if (worst > 70) parts[0] += ` <span style="opacity:.7">(${Math.round(worst)} ms hitch)</span>`;
    for (const p of getPlayers()) {
      if (!p.connected || p.kb) continue;
      const ms = p.rtt === undefined ? '…' : Math.round(p.rtt);
      const spike = p.spike > (p.rtt ?? 0) * 2 && p.spike > 60 ? ` <span style="opacity:.7">↑${Math.round(p.spike)}</span>` : '';
      parts.push(`${p.name.replace(/[<&]/g, '')} <span style="color:${color(p.rtt ?? 0)}">${ms} ms</span>${spike}`);
    }
    el.innerHTML = '📶 ' + parts.join(' · ');
  }

  return {
    // A phone answered a ping.
    pong(p, m) {
      if (!p || typeof m.ts !== 'number') return;
      const rtt = Math.max(0, performance.now() - m.ts);
      p.rtt = p.rtt === undefined ? rtt : p.rtt * 0.85 + rtt * 0.15;
      p.spike = Math.max(rtt, (p.spike ?? 0) * 0.97);
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
