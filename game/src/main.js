// DUSTLINE boot: renderer, fixed-step simulation feeding render at display
// rate, pointer-lock flow, and a deterministic capture mode for screenshots:
// ?shot=start|fight|round|site&seed=N stages the game, renders twice, freezes
// it and sets window.__shotReady.
import * as THREE from 'three';
import { createMap } from './map.js';
import { createInput } from './input.js';
import { createWeaponSet } from './weapons.js';
import { createBots } from './bots.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createGame } from './game.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '7', 10) || 7;
const testMode = params.has('test');

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);
// Deterministic captures only: in shot mode every random draw is seeded.
if (shot) Math.random = random;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const lowfx = params.has('lowfx');
renderer.setPixelRatio(lowfx ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !lowfx;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#2b2430');
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 400);
scene.add(camera);

const map = createMap(scene);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud(map);
const weaponSet = createWeaponSet(camera);
const bots = createBots(scene, map, map.shootables);
const input = createInput(renderer.domElement, onLockChange);
const game = createGame({ scene, camera, map, hud, input, weaponSet, bots, effects, audio });

const state = game.state;
const player = game.player;
let frozen = false;
let accumulator = 0;
let lastTime = performance.now();

hud.onPlay(() => {
  audio.unlock();
  if (state.phase === 'matchEnd') {
    game.startMatch();
    input.requestLock();
    return;
  }
  if (state.phase === 'lobby') game.startMatch();
  input.requestLock();
});
hud.onBuyClick((id) => game.buyItem(id));

function onLockChange(locked) {
  if (shot || testMode) return;
  if (locked) {
    state.paused = false;
    hud.hideOverlay();
  } else if (state.phase === 'live' || state.phase === 'buy') {
    state.paused = true;
    hud.showOverlay('paused', 'DUSTLINE', 'Paused. Click to resume the round.', 'Click to resume');
  } else if (state.phase === 'lobby') {
    hud.showOverlay('start', 'DUSTLINE', 'Vanguard vs Wardens. First to 7 rounds takes the depot. Plant the spike at A or B, or clear the other team.', 'Click to play');
  }
}

function aimAt(point) {
  const dx = point.x - player.body.position.x;
  const dy = point.y - (player.body.position.y + player.body.eye);
  const dz = point.z - player.body.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  player.body.yaw = Math.atan2(-dx, -dz);
  player.body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
}

function settle(steps) {
  game.syncCamera(camera); // keep the camera on the player: nameplate range reads it
  for (let i = 0; i < steps; i += 1) game.step(FIXED_STEP);
}

function fireAt(point, targetBot) {
  aimAt(point);
  game.syncCamera(camera); // the ray reads the camera, so sync before stepping
  const hpBefore = targetBot ? targetBot.hp : null;
  input.state.firing = true;
  game.step(FIXED_STEP);
  input.state.firing = false;
  if (targetBot && hpBefore !== null && targetBot.hp < hpBefore) {
    // Hold the hitmarker for the capture (wall-clock timeouts outrun slow frames).
    hud.hitMarker(targetBot.hp <= 0, 5000);
  }
  settle(2);
}

function runShot(name) {
  hud.hideOverlay();
  state.paused = false;
  game.startMatch();
  if (name === 'start') {
    // Buy phase at spawn, buy menu open, looking up mid toward Site A.
    player.body.position.set(-6, 0, 19.5);
    aimAt(new THREE.Vector3(6, 1.5, -8));
    settle(10);
  } else if (name === 'fight') {
    // Mid-round: step into mid, put a Warden in the crosshair, fire.
    state.timer = 82;
    state.phase = 'live';
    hud.setPhase('LIVE');
    hud.showBuy(false, player.money, player.owned);
    state.buyOpen = false;
    player.body.position.set(-2, 0, 6);
    const enemy = bots.bots.find((b) => b.team === 'warden' && b.alive);
    if (enemy) {
      enemy.body.position.set(2, 0, -6);
      enemy.body.velocity.set(0, 0, 0);
      enemy.body.yaw = Math.atan2(4, -12); // face the player
      enemy.still = true;
      enemy.parts.group.position.copy(enemy.body.position);
      enemy.parts.group.rotation.y = enemy.body.yaw;
    }
    settle(30);
    if (enemy) fireAt(new THREE.Vector3(enemy.body.position.x, 1.35, enemy.body.position.z), enemy);
    settle(4);
  } else if (name === 'round') {
    // Round won: banner + scoreboard showing. Coherent staged tally:
    // round 2 just ended 2-1 for Vanguard; the four Wardens fell to 4 kills.
    state.phase = 'live';
    state.timer = 60;
    hud.showBuy(false, player.money, player.owned);
    state.buyOpen = false;
    player.body.position.set(4, 0, 10);
    aimAt(new THREE.Vector3(-4, 1.5, -10));
    settle(20);
    game.state.round = 2;
    game.state.scoreV = 1;
    game.state.scoreW = 1;
    game.player.kills = 2;
    game.player.deaths = 0;
    const vBots = bots.bots.filter((b) => b.team === 'vanguard');
    if (vBots[0]) { vBots[0].kills = 1; vBots[0].deaths = 0; }
    if (vBots[1]) { vBots[1].kills = 1; vBots[1].deaths = 0; }
    for (const b of bots.bots) {
      if (b.team === 'warden') { b.hp = 0; b.alive = false; b.deaths = 1; }
    }
    game.debugEndRound('vanguard', 'All Wardens eliminated');
    settle(30);
    // Re-show the banner with a long hold: wall-clock timeouts outrun slow
    // capture frames, so the banner must not expire before the paint.
    hud.banner('ROUND WON', 'All Wardens eliminated', 'win', 30000);
  } else if (name === 'site') {
    // Site B yard from the defender side: containers, pad, a teammate pushing.
    state.timer = 74;
    state.phase = 'live';
    hud.setPhase('LIVE');
    hud.showBuy(false, player.money, player.owned);
    state.buyOpen = false;
    player.body.position.set(-19, 0, -5);
    const mate = bots.bots.find((b) => b.team === 'vanguard' && b.alive);
    if (mate) {
      mate.body.position.set(-17.5, 0, -7.5);
      mate.body.yaw = Math.atan2(5.5, 3.5); // face Site B
      mate.still = true;
      mate.parts.group.position.copy(mate.body.position);
      mate.parts.group.rotation.y = mate.body.yaw;
    }
    settle(30);
    aimAt(new THREE.Vector3(-24, 1.4, -13));
    // A Warden defender holding the B pad, so the shot shows both sides.
    const foe = bots.bots.find((b) => b.team === 'warden' && b.alive);
    if (foe) {
      foe.body.position.set(-23, 0, -8.5);
      foe.body.velocity.set(0, 0, 0);
      foe.body.yaw = Math.atan2(7, 6.5); // face south toward the player
      foe.still = true;
      foe.parts.group.position.copy(foe.body.position);
      foe.parts.group.rotation.y = foe.body.yaw;
    }
    settle(6);
  }
  game.syncCamera(camera);
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    game.syncCamera(camera);
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      game.step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    game.syncCamera(camera);
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Debug handle for playtesting: state, positions and a way to force a round.
// The camera is exposed so a playtest can sync it after teleporting the
// player (the rays read the camera, and it only syncs in the render loop).
window.__dustline = {
  game, player, input, bots: bots.bots, camera, scene,
  state: () => ({
    phase: state.phase, round: state.round, scoreV: state.scoreV, scoreW: state.scoreW,
    timer: Math.round(state.timer), money: player.money, hp: player.hp,
    aliveV: bots.aliveCount('vanguard') + (player.alive ? 1 : 0),
    aliveW: bots.aliveCount('warden'), spike: state.spike.planted,
  }),
  errors: [],
};
window.addEventListener('error', (e) => window.__dustline.errors.push(String(e.message)));

game.syncCamera(camera);
hud.setHealth(100, 0);
hud.setAmmo(12, 48, 'P9 · SEMI');
hud.setMoney(800);
hud.setTimer(15, 'buy');
if (shot) runShot(shot);
else if (testMode) {
  hud.hideOverlay();
  state.paused = false;
  game.startMatch();
  requestAnimationFrame(frame);
} else {
  hud.showOverlay('start', 'DUSTLINE', 'Vanguard vs Wardens. First to 7 rounds takes the depot. Plant the spike at A or B, or clear the other team.', 'Click to play');
  requestAnimationFrame(frame);
}
