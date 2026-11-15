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
const ACCENT = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f0a830'), roughness: 0.5, metalness: 0.3 });

function buildViewModel(kind) {
  const model = new THREE.Group();
  const add = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || BODY);
    m.position.set(x, y, z);
    model.add(m);
    return m;
  };
  if (kind === 'pistol') {
    add(0.07, 0.09, 0.22, 0, 0, -0.1);
    add(0.06, 0.12, 0.07, 0, -0.09, 0.02, GRIP);
    add(0.02, 0.03, 0.02, 0, 0.06, -0.2, ACCENT);
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
  model.position.set(0.24, -0.2, -0.42);
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
  flash.position.set(0.24, -0.17, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color('#ffb13d'), 0, 6);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const state = { mag: 12, reserve: 48, cooldown: 0, reloadLeft: 0, flash: 0, kick: 0 };
  let bobPhase = 0;
  let swayX = 0;
  let swayY = 0;

  // lookX: mouse-look delta this frame (px); speed: ground speed in m/s.
  // The view model lags the look slightly and bobs with the walk.
  function step(dt, lookX = 0, speed = 0) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    bobPhase += dt * speed * 1.9;
    const bobAmt = Math.min(1, speed / 5.4);
    const swayTarget = Math.max(-1, Math.min(1, lookX * 0.02));
    swayX += (swayTarget - swayX) * Math.min(1, dt * 10);
    swayY += (0 - swayY) * Math.min(1, dt * 10);
    model.position.x = 0.24 - swayX * 0.035 + Math.sin(bobPhase) * 0.008 * bobAmt;
    model.position.y = -0.2 + Math.abs(Math.sin(bobPhase)) * 0.012 * bobAmt + swayY * 0.02;
    model.position.z = -0.42 + state.kick;
    model.rotation.x = state.kick * 2.4;
    model.rotation.z = -swayX * 0.06 + Math.sin(bobPhase) * 0.012 * bobAmt;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 28;
    flashLight.intensity = state.flash > 0 ? 22 : 0;
    if (state.reloadLeft > 0) {
      const d = def();
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (d.reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = d.mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
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
      model.clear();
      buildViewModel(def().kind).children.forEach((c) => model.add(c));
      const d = def();
      state.mag = d.mag;
      state.reserve = d.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
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
      out.set(0.24, -0.17, -0.95);
      return camera.localToWorld(out);
    },
  };
}
