// Computer-controlled racers. Writes into kart.input like a phone would.

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function driveBot(k, dt, race) {
  const { track, items, order, karts } = race;
  const cl = track.cl;
  const ai = k.ai;
  const inp = k.input;
  ai.phase += dt * 0.25;

  // Wander across the road so bots don't drive single-file.
  let line = ai.line + Math.sin(ai.phase) * 3;
  const ahead = (10 + Math.abs(k.speed) * 0.55) / cl.seg;
  // Dodge hazards in front.
  const probe = cl.pointAt(k.idx + ahead, line);
  for (const h of items.hazardsNear(probe.x, probe.z, 6)) {
    if (h.owner === k && h.type !== 'banana') continue;
    const hl = cl.locate(h.x, h.z, k.idx).lateral;
    line = hl > 0 ? hl - 5 : hl + 5;
  }
  line = Math.max(-7, Math.min(7, line));
  const target = cl.pointAt(k.idx + k.f + ahead, line);
  const want = Math.atan2(target.x - k.x, target.z - k.z);
  // heading decreases when steering right (see Kart.step), so steer = -diff.
  const diff = angleDiff(want, k.heading);
  inp.steer = Math.max(-1, Math.min(1, -diff * 2.4));
  inp.gas = true;
  inp.brake = Math.abs(diff) > 1.3 && k.speed > 10;

  // Upcoming curvature decides drifting.
  const i0 = cl.wrap(k.idx + Math.round(6 / cl.seg));
  const i1 = cl.wrap(k.idx + Math.round(40 / cl.seg));
  const bend = Math.abs(angleDiff(Math.atan2(cl.tx[i1], cl.tz[i1]), Math.atan2(cl.tx[i0], cl.tz[i0])));
  if (k.drifting) {
    ai.driftHold -= dt;
    inp.drift = ai.driftHold > 0 || bend > 0.35;
  } else {
    inp.drift = bend > 0.55 && k.speed > 14 && Math.abs(inp.steer) > 0.4 && Math.random() < race.skill;
    if (inp.drift) ai.driftHold = 0.6 + Math.random() * 1.2;
  }

  // Items.
  inp.item = false;
  if (k.item && k.roulette <= 0) {
    ai.itemDelay -= dt;
    if (ai.itemDelay > 0) return;
    const i = order.indexOf(k);
    const front = order[i - 1];
    const behind = order[i + 1];
    const near = (o, r) => o && (o.x - k.x) ** 2 + (o.z - k.z) ** 2 < r * r;
    let fire = false;
    switch (k.item) {
      case 'mushroom':
      case 'triple':
        fire = !k.offroad || Math.random() < 0.5;
        break;
      case 'star':
      case 'lightning':
        fire = true;
        break;
      case 'red':
        fire = !!front;
        break;
      case 'green':
        if (front && near(front, 45)) {
          const a = Math.abs(angleDiff(Math.atan2(front.x - k.x, front.z - k.z), k.heading));
          fire = a < 0.12;
        }
        if (!fire && behind && near(behind, 18)) {
          inp.brake = true;
          fire = true;
        }
        break;
      case 'banana':
        fire = (behind && near(behind, 25)) || Math.random() < 0.08;
        break;
    }
    if (fire) {
      inp.item = true;
      ai.itemDelay = 0.4 + Math.random() * 2.5;
    } else {
      ai.itemDelay = 0.3;
    }
  } else {
    ai.itemDelay = Math.max(ai.itemDelay, 0.5 + Math.random() * 1.5);
  }
  void karts;
}

// Rubber banding: bots near a human feel fair; far behind they catch up a bit.
export function botSpeedMult(k, leaderHuman, base) {
  if (!leaderHuman) return base;
  const gap = (leaderHuman.progress - k.progress) * 1; // in samples
  if (gap > 120) return base * 1.08;
  if (gap > 40) return base * 1.03;
  if (gap < -120) return base * 0.93;
  return base;
}
