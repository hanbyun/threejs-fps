// The arsenal. Four guns with distinct damage, fire rate, spread and price,
// plus a frag grenade. One module owns the numbers and the view model;
// game.js owns the ray and the damage.
import * as THREE from 'three';

export const WEAPONS = {
  p9: { name: 'P9', kind: 'pistol', price: 0, damage: 34, headMult: 2.0, mag: 12, reserve: 48, gap: 0.17, auto: false, reload: 1.4, spreadStill: 0.006, spreadMove: 0.03, kick: 0.011, range: 60 },
  vex9: { name: 'Vex-9', kind: 'smg', price: 1500, damage: 26, headMult: 2.0, mag: 30, reserve: 120, gap: 0.085, auto: true, reload: 1.8, spreadStill: 0.012, spreadMove: 0.038, kick: 0.008, range: 45 },
  ar77: { name: 'AR-77', kind: 'rifle', price: 2700, damage: 38, headMult: 2.5, mag: 25, reserve: 75, gap: 0.11, auto: true, reload: 2.2, spreadStill: 0.004, spreadMove: 0.026, kick: 0.013, range: 80 },
  dm12: { name: 'DM-12', kind: 'dmr', price: 4100, damage: 78, headMult: 2.5, mag: 5, reserve: 20, gap: 0.55, auto: false, reload: 2.8, spreadStill: 0.001, spreadMove: 0.02, kick: 0.03, range: 110 },
  knife: { name: 'Knife', kind: 'knife', price: 0, damage: 45, headMult: 1.8, mag: 0, reserve: 0, gap: 0.45, auto: false, reload: 0, spreadStill: 0, spreadMove: 0, kick: 0.004, range: 2.4 },
};

export const FRAG = { name: 'Frag', price: 300, fuse: 1.6, radius: 6.5, damage: 110 };
export const FLASH = { name: 'Flash', price: 200, fuse: 1.4, radius: 18, blind: 2.2 };
export const SMOKE = { name: 'Smoke', price: 300, fuse: 1.5, radius: 3.5, linger: 12 };
export const ARMOR = { name: 'Plating', price: 650, value: 50 };

const GRIP = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2622'), roughness: 0.7, metalness: 0.25 });
const BODY = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3d3a36'), roughness: 0.45, metalness: 0.55 });
const SLIDE = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4c4741'), roughness: 0.38, metalness: 0.6 });
const DARK = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d1b19'), roughness: 0.5, metalness: 0.5 });
const ACCENT = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f0a830'), roughness: 0.5, metalness: 0.3 });

function buildViewModel(kind) {
  const model = new THREE.Group();
  const add = (w, h, d, x, y, z, mat, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || BODY);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    model.add(m);
    return m;
  };
  if (kind === 'pistol') {
    // P9, rebuilt slim: a long low slide with serrations and sights, a
    // barrel poking out the front, an angled grip with a base plate, and a
    // trigger guard — it should read as a pistol at a glance, not a slab.
    add(0.05, 0.045, 0.26, 0, 0.012, -0.10, SLIDE); // slide
    add(0.036, 0.008, 0.24, 0, 0.038, -0.10, BODY); // slide top rib
    add(0.054, 0.038, 0.006, 0, 0.012, 0.005, DARK); // rear serrations
    add(0.054, 0.038, 0.006, 0, 0.012, 0.016, DARK);
    add(0.054, 0.038, 0.006, 0, 0.012, 0.027, DARK);
    add(0.006, 0.018, 0.055, 0.025, 0.02, -0.155, DARK); // ejection port
    add(0.018, 0.018, 0.05, 0, 0.012, -0.245, DARK); // barrel
    add(0.024, 0.024, 0.012, 0, 0.012, -0.268, DARK); // muzzle ring
    add(0.008, 0.02, 0.008, 0, 0.05, -0.205, DARK); // front sight post
    add(0.007, 0.007, 0.007, 0, 0.062, -0.205, ACCENT); // fiber-optic dot
    add(0.009, 0.016, 0.009, -0.014, 0.046, 0.018, DARK); // rear sight L
    add(0.009, 0.016, 0.009, 0.014, 0.046, 0.018, DARK); // rear sight R
    add(0.044, 0.028, 0.19, 0, -0.026, -0.075, BODY); // frame
    add(0.008, 0.032, 0.007, 0, -0.052, -0.135, DARK); // trigger guard front
    add(0.008, 0.007, 0.055, 0, -0.066, -0.108, DARK); // trigger guard bottom
    add(0.007, 0.022, 0.009, 0, -0.048, -0.102, DARK); // trigger
    add(0.042, 0.115, 0.056, 0, -0.095, 0.032, GRIP, -0.28); // raked grip
    add(0.044, 0.09, 0.008, 0, -0.09, 0.062, BODY, -0.28); // backstrap
    add(0.05, 0.014, 0.062, 0, -0.148, 0.047, DARK, -0.28); // mag base plate
  } else if (kind === 'smg') {
    add(0.08, 0.1, 0.4, 0, 0, -0.12);
    add(0.05, 0.05, 0.3, 0, 0.02, -0.4, GRIP);
    add(0.06, 0.16, 0.06, 0, -0.11, 0.02, GRIP);
    add(0.07, 0.06, 0.12, 0, -0.03, 0.08, GRIP);
  } else if (kind === 'dmr') {
    add(0.08, 0.1, 0.55, 0, 0, -0.18);
    add(0.04, 0.04, 0.42, 0, 0.03, -0.5, GRIP);
    add(0.07, 0.07, 0.16, 0, 0.09, -0.1, GRIP); // scope
    add(0.06, 0.14, 0.06, 0, -0.1, 0.06, GRIP);
    add(0.07, 0.08, 0.2, 0, -0.02, 0.24, GRIP);
    add(0.02, 0.02, 0.06, 0, 0.06, -0.28, ACCENT);
  } else if (kind === 'knife') {
    // Short blade held low, edge forward.
    add(0.02, 0.05, 0.3, 0, -0.02, -0.22, new THREE.MeshStandardMaterial({ color: new THREE.Color('#b8bcc2'), roughness: 0.25, metalness: 0.85 }));
    add(0.05, 0.06, 0.12, 0, -0.04, -0.02, GRIP);
  } else {
    // rifle
    add(0.08, 0.1, 0.48, 0, 0, -0.14);
    add(0.05, 0.05, 0.34, 0, 0.02, -0.44, GRIP);
    add(0.06, 0.15, 0.06, 0, -0.11, 0.0, GRIP);
    add(0.07, 0.07, 0.2, 0, -0.02, 0.26, GRIP);
    add(0.03, 0.05, 0.03, 0, 0.07, -0.36, ACCENT);
  }
  model.position.set(0.26, -0.21, -0.44);
  return model;
}

// Four-point star for the muzzle flash: a square plane reads as a blob,
// a star reads as a gunshot.
function starTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.translate(64, 64);
  ctx.fillStyle = '#ffcf6e';
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const r = i % 2 === 0 ? 62 : 12;
    const a = (i / 8) * Math.PI * 2;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createWeaponSet(camera) {
  let current = 'p9';
  const def = () => WEAPONS[current];
  const model = buildViewModel('pistol');
  camera.add(model);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ map: starTexture(), color: new THREE.Color('#ffb13d'), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.26, -0.19, -0.78);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color('#ffb13d'), 0, 6);
  flashLight.position.set(0.26, -0.18, -0.6);
  camera.add(flashLight);

  const state = { mag: 12, reserve: 48, cooldown: 0, reloadLeft: 0, flash: 0, kick: 0 };
  let bobPhase = 0;
  let breathePhase = 0;
  let swayX = 0;
  let swayY = 0;
  let drawT = 0.4; // the weapon rises into frame on load and on equip

  // lookX: mouse-look delta this frame (px); speed: ground speed in m/s.
  // The view model lags the look slightly, breathes when idle, bobs with
  // the walk, kicks on fire, and dips and tilts through a reload.
  function step(dt, lookX = 0, speed = 0) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 12);
    drawT = Math.max(0, drawT - dt);
    bobPhase += dt * speed * 1.9;
    breathePhase += dt * 1.9;
    const bobAmt = Math.min(1, speed / 5.4);
    const breathe = 1 - bobAmt; // idle breathing fades out while moving
    const swayTarget = Math.max(-1, Math.min(1, lookX * 0.02));
    swayX += (swayTarget - swayX) * Math.min(1, dt * 10);
    swayY += (0 - swayY) * Math.min(1, dt * 10);
    // Reload dip: the gun drops and tilts (muzzle up) mid-reload, then
    // comes back; a sine over reload progress so it returns to rest cleanly.
    let dip = 0;
    if (state.reloadLeft > 0) {
      const d = def();
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      dip = Math.sin((1 - state.reloadLeft / d.reload) * Math.PI);
      if (state.reloadLeft === 0) {
        const need = d.mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
    const draw = drawT / 0.4;
    const idleX = Math.cos(breathePhase * 0.83) * 0.002 * breathe;
    const idleY = Math.sin(breathePhase) * 0.003 * breathe;
    const idleRoll = Math.sin(breathePhase * 0.5) * 0.004 * breathe;
    model.position.x = 0.26 - swayX * 0.035 + Math.sin(bobPhase) * 0.008 * bobAmt + idleX - dip * 0.02;
    model.position.y = -0.21 + Math.abs(Math.sin(bobPhase)) * 0.012 * bobAmt + swayY * 0.02 + idleY + state.kick * 0.12 - dip * 0.085 - draw * draw * 0.14;
    model.position.z = -0.44 + state.kick;
    model.rotation.x = state.kick * 3.0 + dip * 0.5 + draw * 0.35;
    model.rotation.y = -swayX * 0.10;
    model.rotation.z = -0.07 - swayX * 0.06 + Math.sin(bobPhase) * 0.012 * bobAmt + idleRoll + dip * 0.18 + draw * 0.1;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 28;
    flashLight.intensity = state.flash > 0 ? 22 : 0;
  }

  return {
    state,
    step,
    current: () => current,
    def,
    equip(id) {
      if (!WEAPONS[id] || id === current) return false;
      current = id;
      // Rebuild the view model in place: swap the group's children.
      // Copy the list first: add() pulls each child out of the fresh
      // group, which would shrink the live array mid-iteration and skip
      // every other part.
      model.clear();
      [...buildViewModel(def().kind).children].forEach((c) => model.add(c));
      const d = def();
      state.mag = d.mag;
      state.reserve = d.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      drawT = 0.4; // fresh weapon rises into frame
      return true;
    },
    ready() {
      return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    pullTrigger() {
      state.cooldown = def().gap;
      state.flash = 0.06;
      state.kick = 0.05 + def().kick;
    },
    takeRound() {
      if (state.mag <= 0) return false;
      state.mag -= 1;
      return true;
    },
    reload() {
      const d = def();
      if (state.reloadLeft > 0 || state.mag === d.mag || state.reserve === 0) return false;
      state.reloadLeft = d.reload;
      return true;
    },
    spread(speed) {
      const d = def();
      return d.spreadStill + Math.min(1, speed / 5.4) * d.spreadMove;
    },
    refill() {
      const d = def();
      state.mag = d.mag;
      state.reserve = d.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
    },
    muzzlePos(out) {
      out.set(0.26, -0.19, -0.78);
      return camera.localToWorld(out);
    },
  };
}
