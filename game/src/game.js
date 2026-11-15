// DUSTLINE game core: one state object, one fixed-step update. Rounds, economy,
// buy phase, plant/defuse objective, grenades, hitscan shooting and damage all
// live here; rendering lives in main.js, bot brains in bots.js.
import * as THREE from 'three';
import { createBody } from './mover.js';
import { WEAPONS, FRAG, FLASH, SMOKE, ARMOR } from './weapons.js';

const FIXED = 1 / 60;
const BUY_SECONDS = 15;
const ROUND_SECONDS = 100;
const SPIKE_SECONDS = 35;
const PLANT_SECONDS = 3;
const DEFUSE_SECONDS = 5;
const WIN_ROUNDS = 7;
const MAX_ROUNDS = 12;
const START_MONEY = 800;
const KILL_MONEY = 300;
const WIN_MONEY = 3250;
const LOSS_MONEY = 1900;

export function createGame(deps) {
  const { scene, camera, map, hud, input, weaponSet, bots, effects, audio } = deps;
  const raycaster = new THREE.Raycaster();
  const shootables = map.shootables;
  const tmpDir = new THREE.Vector3();
  const tmpOut = new THREE.Vector3();
  const tmpWish = new THREE.Vector3();

  const playerMover = createBody(map.colliders, 0, 19.5, map.ramps);
  const player = {
    team: 'vanguard', name: 'You', isPlayer: true, alive: true,
    hp: 100, armor: 0, money: START_MONEY,
    frags: 0, fragsMax: 2, flash: 0, flashMax: 2, smoke: 0, smokeMax: 2,
    weapon: 'p9', primary: null, slot: 'pistol', owned: ['p9'],
    kills: 0, deaths: 0, meleeAt: 0, throwAt: 0,
    body: playerMover.body, mover: playerMover, spottedUntil: 0,
  };
  const agents = [player, ...bots.bots];

  const state = {
    phase: 'lobby', // lobby | buy | live | roundEnd | matchEnd
    paused: false,
    round: 1, scoreV: 0, scoreW: 0,
    timer: BUY_SECONDS, time: 0,
    started: false, buyOpen: false,
    spike: { planted: false, position: new THREE.Vector3(), timer: 0, site: null },
    channel: 0, channelKind: null,
    grenades: [],
    smokes: [], // active smoke clouds: { pos, r, until }
    shake: 0,
    recoilPitch: 0,
    spectate: null,
    autoReloadAt: 0,
    bobPhase: 0,
    bobAmp: 0,
    lastLookX: 0,
    lastPraiseAt: 0,
  };
  const tmpRight = new THREE.Vector3();
  const tmpSmoke = new THREE.Vector3();

  // The buy menu's "owned" list: guns owned, plus consumables at max count.
  function buyOwned() {
    const list = [...player.owned];
    if (player.frags >= player.fragsMax) list.push('frag');
    if (player.flash >= player.flashMax) list.push('flash');
    if (player.smoke >= player.smokeMax) list.push('smoke');
    if (player.armor >= ARMOR.value) list.push('armor');
    return list;
  }

  function refreshBuy() {
    hud.showBuy(state.buyOpen, player.money, buyOwned());
  }

  // What the weapon panel shows for the current slot.
  function ammoDisplay() {
    if (player.slot === 'knife') hud.setAmmo('—', '', 'KNIFE · MELEE');
    else if (player.slot === 'frag') hud.setAmmo(player.frags, player.fragsMax, 'FRAG GRENADE');
    else if (player.slot === 'flash') hud.setAmmo(player.flash, player.flashMax, 'FLASH GRENADE');
    else if (player.slot === 'smoke') hud.setAmmo(player.smoke, player.smokeMax, 'SMOKE GRENADE');
    else {
      const d = WEAPONS[player.weapon];
      hud.setAmmo(weaponSet.state.mag, weaponSet.state.reserve, `${d.name} · ${d.auto ? 'AUTO' : 'SEMI'}`);
    }
  }

  // Segment-sphere test: does a sightline pass through a live smoke cloud?
  function smokeBlocked(from, to) {
    for (const s of state.smokes) {
      if (state.time > s.until) continue;
      tmpSmoke.subVectors(to, from);
      const lenSq = tmpSmoke.lengthSq();
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1,
        ((s.pos.x - from.x) * tmpSmoke.x + (s.pos.y - from.y) * tmpSmoke.y + (s.pos.z - from.z) * tmpSmoke.z) / lenSq));
      const cx = from.x + tmpSmoke.x * t;
      const cy = from.y + tmpSmoke.y * t;
      const cz = from.z + tmpSmoke.z * t;
      if (Math.hypot(s.pos.x - cx, s.pos.y - cy, s.pos.z - cz) < s.r) return true;
    }
    return false;
  }

  function resetPositions() {
    const spawn = map.spawns.vanguard[0]; // player takes spawn 0; bots use 1-4
    player.body.position.copy(spawn);
    player.body.velocity.set(0, 0, 0);
    player.body.yaw = 0;
    player.body.pitch = 0;
    player.alive = true;
    player.hp = 100;
    player.spectate = null;
    state.spectate = null;
    bots.resetRound(state.round);
  }

  function startBuyPhase() {
    state.phase = 'buy';
    state.timer = BUY_SECONDS;
    state.spike.planted = false;
    state.spike.timer = 0;
    state.channel = 0;
    state.channelKind = null;
    state.grenades.length = 0;
    resetPositions();
    weaponSet.refill();
    hud.setHealth(player.hp, player.armor);
    ammoDisplay();
    hud.setMoney(player.money);
    hud.setPhase('BUY PHASE');
    hud.banner(`ROUND ${state.round} — BUY PHASE`, 'Press B to buy · round starts soon', '');
    hud.fade();
    hud.showBuy(true, player.money, buyOwned());
    state.buyOpen = true;
    hud.hideScoreboard();
    hud.setSpectate(false);
  }

  function startRound() {
    state.phase = 'live';
    state.timer = ROUND_SECONDS;
    state.buyOpen = false;
    hud.showBuy(false, player.money, buyOwned());
    hud.setPhase('LIVE');
    hud.banner(`ROUND ${state.round}`, 'Plant the spike at A or B — or clear the Wardens', '');
    hud.fade();
    // A teammate calls the execute on the radio.
    const pushers = bots.bots.filter((b) => b.alive && b.team === 'vanguard');
    if (pushers.length) {
      const p = pushers[Math.floor(Math.random() * pushers.length)];
      hud.radio(p.name, p.role, `Pushing ${p.site === 'A' ? 'A Long' : 'B Long'} — ${p.site} execute`);
    }
  }

  function endRound(winner, reason) {
    if (state.phase !== 'live') return;
    state.phase = 'roundEnd';
    state.timer = 4;
    state.channel = 0;
    hud.setChannel(null, 0);
    hud.setPhase('ROUND END');
    if (winner === 'vanguard') {
      state.scoreV += 1;
      player.money += WIN_MONEY;
      hud.banner('ROUND WON', reason, 'win');
      audio.roundWin();
    } else {
      state.scoreW += 1;
      player.money += LOSS_MONEY;
      hud.banner('ROUND LOST', reason, 'lose');
      audio.roundLose();
    }
    for (const b of bots.bots) {
      b.money += b.team === winner ? WIN_MONEY : LOSS_MONEY;
      b.money = Math.min(b.money, 16000);
    }
    player.money = Math.min(player.money, 16000);
    hud.setMoney(player.money);
    hud.setScore(state.scoreV, state.scoreW, state.round);
    showScoreboard('ROUND ' + state.round);
  }

  function endMatch() {
    state.phase = 'matchEnd';
    const won = state.scoreV > state.scoreW;
    hud.showOverlay(
      'end',
      won ? `VANGUARD WINS ${state.scoreV}–${state.scoreW}` : `WARDENS WIN ${state.scoreW}–${state.scoreV}`,
      won ? 'Dustline is yours. The depot falls silent.' : 'The Wardens held the depot. Run it back.',
      'Play again',
    );
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function showScoreboard(title) {
    const rows = agents.map((a) => ({ name: a.name, team: a.team, kills: a.kills || 0, deaths: a.deaths || 0, money: a.money }));
    hud.showScoreboard(rows, title);
  }

  function startMatch() {
    state.scoreV = 0;
    state.scoreW = 0;
    state.round = 1;
    state.started = true;
    player.money = START_MONEY;
    player.weapon = 'p9';
    player.primary = null;
    player.slot = 'pistol';
    player.owned = ['p9'];
    player.frags = 0;
    player.flash = 0;
    player.smoke = 0;
    player.armor = 0;
    player.kills = 0;
    player.deaths = 0;
    player.meleeAt = 0;
    player.throwAt = 0;
    weaponSet.equip('p9');
    for (const b of bots.bots) { b.money = START_MONEY; b.kills = 0; b.deaths = 0; }
    startBuyPhase();
  }

  function damageFalloff(dist) {
    return 1 - 0.4 * Math.max(0, Math.min(1, (dist - 25) / 35));
  }

  function applyDamage(target, amount, part, attacker) {
    if (!target.alive) return false;
    let dmg = amount;
    if (part === 'head') dmg *= 2;
    const absorbed = Math.min(target.armor, dmg * 0.5);
    target.armor -= absorbed;
    target.hp -= (dmg - absorbed);
    if (target.isPlayer) {
      hud.damageFlash();
      audio.hurt();
      hud.setHealth(target.hp, target.armor);
    } else {
      target.flinch = 1; // bots flinch when hit, then recover
      if (target.parts && target.parts.setHp) target.parts.setHp(Math.max(0, target.hp) / 100);
    }
    if (target.hp > 0) return false;
    target.hp = 0;
    target.alive = false;
    target.deaths = (target.deaths || 0) + 1;
    if (attacker) {
      attacker.kills = (attacker.kills || 0) + 1;
      attacker.money = Math.min((attacker.money || 0) + KILL_MONEY, 16000);
      if (attacker.isPlayer) { hud.setMoney(player.money); audio.kill(); }
    }
    return true;
  }

  function checkRoundEnd() {
    if (state.phase !== 'live') return;
    const vAlive = player.alive ? 1 : 0;
    const wAlive = bots.aliveCount('warden');
    const vBots = bots.aliveCount('vanguard');
    if (wAlive === 0) endRound('vanguard', 'All Wardens eliminated');
    else if (vAlive + vBots === 0) endRound('warden', 'All Vanguard eliminated');
  }

  function playerShoot() {
    const def = WEAPONS[player.weapon];
    if (!weaponSet.takeRound()) {
      audio.dryClick();
      weaponSet.reload();
      return;
    }
    camera.getWorldDirection(tmpDir);
    const spread = weaponSet.spread(playerMover.groundSpeed());
    tmpDir.x += (Math.random() * 2 - 1) * spread;
    tmpDir.y += (Math.random() * 2 - 1) * spread;
    tmpDir.z += (Math.random() * 2 - 1) * spread;
    tmpDir.normalize();
    raycaster.set(camera.position, tmpDir);
    raycaster.far = def.range;
    const hit = raycaster.intersectObjects(shootables, false)[0];
    const muzzle = weaponSet.muzzlePos(new THREE.Vector3());
    let end;
    if (hit) {
      end = hit.point;
      const agent = hit.object.userData.agent;
      if (agent && agent.alive) {
        const dist = camera.position.distanceTo(hit.point);
        const dmg = def.damage * damageFalloff(dist);
        const killed = applyDamage(agent, dmg, hit.object.userData.part, player);
        hud.hitMarker(killed);
        audio.hit();
        if (killed) {
          hud.killfeed(player.name, agent.name, def.name, hit.object.userData.part === 'head');
          // A teammate calls out a clean headshot on the radio.
          if (hit.object.userData.part === 'head' && state.time - state.lastPraiseAt > 8) {
            state.lastPraiseAt = state.time;
            const mates = bots.bots.filter((b) => b.alive && b.team === 'vanguard');
            if (mates.length) {
              const m = mates[Math.floor(Math.random() * mates.length)];
              hud.radio(m.name, m.role, `Clean headshot — ${agent.name} is down`);
            }
          }
          checkRoundEnd();
        }
      } else {
        effects.impact(hit.point);
      }
    } else {
      end = tmpOut.copy(camera.position).addScaledVector(tmpDir, def.range);
    }
    effects.tracer(muzzle, end);
    tmpRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    effects.shell(muzzle, tmpRight);
    weaponSet.pullTrigger();
    audio.shot(def.kind);
    // Recoil lives in its own offset and decays; the aim pitch never drifts.
    state.recoilPitch = Math.min(0.09, state.recoilPitch + def.kick * 0.5);
    playerMover.body.yaw += (Math.random() * 2 - 1) * def.kick * 0.25;
    state.shake = Math.min(0.5, state.shake + def.kick * 2);
    ammoDisplay();
    if (weaponSet.state.mag === 0) state.autoReloadAt = state.time + 0.45;
  }

  function playerMelee() {
    const def = WEAPONS.knife;
    camera.getWorldDirection(tmpDir);
    raycaster.set(camera.position, tmpDir);
    raycaster.far = def.range;
    const hit = raycaster.intersectObjects(shootables, false)[0];
    if (hit) {
      const agent = hit.object.userData.agent;
      if (agent && agent.alive) {
        const killed = applyDamage(agent, def.damage, hit.object.userData.part, player);
        hud.hitMarker(killed);
        audio.hit();
        if (killed) {
          hud.killfeed(player.name, agent.name, 'Knife', hit.object.userData.part === 'head');
          checkRoundEnd();
        }
      } else {
        effects.impact(hit.point);
      }
    }
    weaponSet.pullTrigger(); // the swing dip
    state.shake = Math.min(0.5, state.shake + 0.08);
    player.meleeAt = state.time + def.gap;
  }

  function botShoot(bot, target) {
    const def = WEAPONS[bot.weapon];
    const from = tmpOut.set(bot.body.position.x, bot.body.position.y + 1.45, bot.body.position.z);
    const to = new THREE.Vector3(target.body.position.x, target.body.position.y + 1.15, target.body.position.z);
    const dist = from.distanceTo(to);
    tmpDir.subVectors(to, from).normalize();
    const spread = 0.028 + dist * 0.0011 + (target.isPlayer ? playerMover.groundSpeed() * 0.004 : 0.008);
    tmpDir.x += (Math.random() * 2 - 1) * spread;
    tmpDir.y += (Math.random() * 2 - 1) * spread;
    tmpDir.z += (Math.random() * 2 - 1) * spread;
    tmpDir.normalize();
    raycaster.set(from, tmpDir);
    raycaster.far = def.range;
    const hit = raycaster.intersectObjects(shootables, false)[0];
    let end;
    if (hit) {
      end = hit.point;
      const agent = hit.object.userData.agent;
      if (agent && agent.alive) {
        const dmg = def.damage * damageFalloff(from.distanceTo(hit.point));
        const killed = applyDamage(agent, dmg, hit.object.userData.part, bot);
        if (killed) {
          hud.killfeed(bot.name, agent.name, def.name, hit.object.userData.part === 'head');
          if (agent.isPlayer) onPlayerDown();
          checkRoundEnd();
        }
      } else {
        effects.impact(hit.point);
      }
    } else {
      end = new THREE.Vector3().copy(from).addScaledVector(tmpDir, def.range);
    }
    effects.tracer(from, end, 0xff9a5c);
    effects.muzzleFlash(from);
    if (target.isPlayer) audio.enemyShot(dist);
  }

  function onPlayerDown() {
    const alive = bots.bots.filter((b) => b.alive && b.team === 'vanguard');
    state.spectate = alive.length ? alive[0] : null;
    hud.setSpectate(!!state.spectate, state.spectate ? state.spectate.name : '');
  }

  function throwUtility(kind) {
    if (state.phase !== 'live' || !player.alive) return;
    const counts = { frag: player.frags, flash: player.flash, smoke: player.smoke };
    if (counts[kind] <= 0) return;
    if (kind === 'frag') player.frags -= 1;
    else if (kind === 'flash') player.flash -= 1;
    else player.smoke -= 1;
    const def = kind === 'frag' ? FRAG : kind === 'flash' ? FLASH : SMOKE;
    camera.getWorldDirection(tmpDir);
    const color = kind === 'frag' ? '#2f6b2f' : kind === 'flash' ? '#e8e8e8' : '#7a7a72';
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.4, metalness: 0.5 }),
    );
    mesh.position.copy(camera.position).addScaledVector(tmpDir, 0.5);
    scene.add(mesh);
    state.grenades.push({
      mesh, fuse: def.fuse, kind,
      vel: tmpDir.clone().multiplyScalar(15).add(new THREE.Vector3(0, 3.5, 0)),
    });
    audio.reload();
  }

  function flashBurst(p) {
    effects.impact(p);
    audio.pop();
    // The player is flashed when the burst is in view and nothing blocks it.
    const toBurst = new THREE.Vector3().subVectors(p, camera.position);
    const dist = toBurst.length();
    if (dist < 30) {
      camera.getWorldDirection(tmpDir);
      const facing = tmpDir.dot(toBurst.clone().normalize());
      raycaster.set(camera.position, toBurst.normalize());
      raycaster.far = dist;
      const blocked = raycaster.intersectObjects(shootables, false)[0];
      if (!blocked && facing > 0.15) hud.flashbang(Math.max(0.25, 1 - dist / 30));
    }
    // Bots facing the burst are blinded for a couple of seconds.
    for (const b of bots.bots) {
      if (!b.alive) continue;
      const d = b.body.position.distanceTo(p);
      if (d > FLASH.radius) continue;
      const fwd = new THREE.Vector3(-Math.sin(b.body.yaw), 0, -Math.cos(b.body.yaw));
      const to = new THREE.Vector3(p.x - b.body.position.x, 0, p.z - b.body.position.z).normalize();
      if (fwd.dot(to) > -0.2) b.blindUntil = state.time + FLASH.blind;
    }
  }

  function smokeBurst(p) {
    effects.smokeCloud(p, SMOKE.linger);
    state.smokes.push({ pos: p.clone(), r: SMOKE.radius, until: state.time + SMOKE.linger });
    audio.pop();
  }

  function explodeGrenade(g) {
    const p = g.mesh.position.clone();
    scene.remove(g.mesh);
    effects.explosion(p);
    audio.explosion();
    for (const a of agents) {
      if (!a.alive) continue;
      const d = Math.hypot(a.body.position.x - p.x, a.body.position.z - p.z);
      const dy = Math.abs(a.body.position.y + 1 - p.y);
      const dist = Math.hypot(d, dy);
      if (dist < FRAG.radius) {
        const killed = applyDamage(a, FRAG.damage * (1 - dist / FRAG.radius), 'torso', player);
        if (killed) {
          hud.killfeed(player.name, a.name, 'Frag', false);
          if (a.isPlayer) onPlayerDown();
        }
      }
    }
    const pd = player.body.position.distanceTo(p);
    if (pd < 10) state.shake = Math.min(1, state.shake + (1 - pd / 10) * 0.7);
    checkRoundEnd();
  }

  function plantDone(bot) {
    const site = bot.site;
    state.spike.planted = true;
    state.spike.position.copy(map.sites[site].center);
    state.spike.timer = SPIKE_SECONDS;
    state.spike.site = site;
    audio.plantBeep();
    hud.setPhase('SPIKE PLANTED');
    hud.banner('SPIKE PLANTED', `Wardens must defuse — ${SPIKE_SECONDS}s to detonation`, 'warn');
    if (bot.isPlayer) {
      player.money = Math.min(player.money + KILL_MONEY, 16000);
      const mates = bots.bots.filter((b) => b.alive && b.team === 'vanguard');
      if (mates.length) hud.radio(mates[0].name, mates[0].role, `Spike down at Site ${site} — hold it`);
    }
  }

  function defuseDone(bot) {
    state.spike.planted = false;
    hud.banner('SPIKE DEFUSED', 'The Wardens saved the depot', 'lose');
    endRound('warden', 'Spike defused');
  }

  function buyItem(id) {
    if (state.phase !== 'buy') return;
    if (id === 'frag') {
      if (player.frags >= player.fragsMax || player.money < FRAG.price) return;
      player.money -= FRAG.price;
      player.frags += 1;
    } else if (id === 'flash') {
      if (player.flash >= player.flashMax || player.money < FLASH.price) return;
      player.money -= FLASH.price;
      player.flash += 1;
    } else if (id === 'smoke') {
      if (player.smoke >= player.smokeMax || player.money < SMOKE.price) return;
      player.money -= SMOKE.price;
      player.smoke += 1;
    } else if (id === 'armor') {
      if (player.armor >= ARMOR.value || player.money < ARMOR.price) return;
      player.money -= ARMOR.price;
      player.armor = ARMOR.value;
    } else if (WEAPONS[id]) {
      if (player.owned.includes(id) || player.money < WEAPONS[id].price) return;
      player.money -= WEAPONS[id].price;
      player.owned.push(id);
      player.primary = id;
      player.slot = 'primary';
      player.weapon = id;
      weaponSet.equip(id);
    } else return;
    audio.buy();
    hud.setMoney(player.money);
    ammoDisplay();
    hud.setHealth(player.hp, player.armor);
    refreshBuy();
  }

  // Weapon slots: 1 primary, 2 pistol, 3 knife, 4 frag, 5 flash, 6 smoke.
  // Utilities keep the last gun equipped; only the panel changes.
  function equipSlot(slot) {
    if (!player.alive) return;
    if (slot === 'primary') {
      if (!player.primary) return;
      player.slot = 'primary';
      player.weapon = player.primary;
      weaponSet.equip(player.primary);
    } else if (slot === 'pistol') {
      player.slot = 'pistol';
      player.weapon = 'p9';
      weaponSet.equip('p9');
    } else if (slot === 'knife') {
      player.slot = 'knife';
      player.weapon = 'knife';
      weaponSet.equip('knife');
    } else if (slot === 'frag' || slot === 'flash' || slot === 'smoke') {
      player.slot = slot;
      player.weapon = slot;
    }
    ammoDisplay();
  }

  function playerChannel(dt) {
    const keys = input.state.keys;
    const wantPlant = keys.has('KeyE') && !state.spike.planted && player.alive && state.phase === 'live';
    const site = playerSite();
    if (wantPlant && site) {
      state.channel += dt;
      state.channelKind = 'plant';
      hud.setChannel(`PLANTING SPIKE — SITE ${site}`, state.channel / PLANT_SECONDS);
      if (state.channel >= PLANT_SECONDS) {
        state.channel = 0;
        state.channelKind = null;
        hud.setChannel(null, 0);
        plantDone({ ...player, site, isPlayer: true });
        hud.setMoney(player.money);
      }
    } else {
      state.channel = 0;
      state.channelKind = null;
      hud.setChannel(null, 0);
    }
  }

  function playerSite() {
    for (const key of ['A', 'B']) {
      const s = map.sites[key];
      if (Math.hypot(s.center.x - player.body.position.x, s.center.z - player.body.position.z) < s.radius) return key;
    }
    return null;
  }

  function step(dt) {
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 1.8);
    state.recoilPitch = Math.max(0, state.recoilPitch - dt * 0.22);
    if (state.paused || state.phase === 'lobby' || state.phase === 'matchEnd') return;

    // Look + movement.
    const look = input.takeLook();
    state.lastLookX = look.x;
    playerMover.body.yaw -= look.x * 0.0022;
    playerMover.body.pitch = Math.max(-1.45, Math.min(1.45, playerMover.body.pitch - look.y * 0.0022));

    const keys = input.state.keys;
    if (player.alive) {
      const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      tmpWish.set(0, 0, 0);
      if (fwd || strafe) {
        const sin = Math.sin(playerMover.body.yaw);
        const cos = Math.cos(playerMover.body.yaw);
        tmpWish.set(-sin * fwd + cos * strafe, 0, -cos * fwd - sin * strafe).normalize();
      }
      const crouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
      playerMover.step(dt, tmpWish, playerMover.WALK_SPEED, keys.has('Space'), crouch);
    }

    // Edge presses.
    for (const code of input.takePressed()) {
      if (code === 'KeyR') {
        if (player.slot === 'primary' || player.slot === 'pistol') weaponSet.reload();
      } else if (code === 'KeyG') throwUtility('frag');
      else if (code === 'KeyB' && state.phase === 'buy') {
        state.buyOpen = !state.buyOpen;
        refreshBuy();
      } else if (state.phase === 'buy' && ['Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'].includes(code)) {
        buyItem({ Digit2: 'vex9', Digit3: 'ar77', Digit4: 'dm12', Digit5: 'frag', Digit6: 'armor', Digit7: 'flash', Digit8: 'smoke' }[code]);
      } else if (code === 'Digit1') equipSlot('primary');
      else if (code === 'Digit2') equipSlot('pistol');
      else if (code === 'Digit3') equipSlot('knife');
      else if (code === 'Digit4') equipSlot('frag');
      else if (code === 'Digit5') equipSlot('flash');
      else if (code === 'Digit6') equipSlot('smoke');
    }
    if (keys.has('Tab')) showScoreboard(`ROUND ${state.round}`);
    else if (state.phase !== 'roundEnd') hud.hideScoreboard();

    // Firing: guns shoot, the knife swings, a selected utility is thrown.
    if (state.phase === 'live' && player.alive && input.state.firing) {
      if (player.slot === 'knife') {
        if (state.time >= player.meleeAt) playerMelee();
      } else if (player.slot === 'frag' || player.slot === 'flash' || player.slot === 'smoke') {
        if (state.time >= player.throwAt) {
          throwUtility(player.slot);
          player.throwAt = state.time + 0.6;
        }
      } else if (weaponSet.ready()) {
        playerShoot();
      }
    }
    if (state.autoReloadAt && state.time >= state.autoReloadAt) {
      state.autoReloadAt = 0;
      weaponSet.reload();
    }

    // Bots.
    bots.step(dt, {
      time: state.time, phase: state.phase, agents, spike: state.spike, camera,
      botShoot, plantDone: (bot) => plantDone(bot), defuseDone,
      radio: (bot, text) => hud.radio(bot.name, bot.role, text),
      smokeBlocked,
    });

    // Plant channel (player).
    playerChannel(dt);

    // Grenades.
    for (let i = state.grenades.length - 1; i >= 0; i -= 1) {
      const g = state.grenades[i];
      g.fuse -= dt;
      g.vel.y -= 12 * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      if (g.mesh.position.y < 0.09) {
        g.mesh.position.y = 0.09;
        // Bounce: keep going forward, damped; only the vertical part flips.
        g.vel.x *= 0.35;
        g.vel.z *= 0.35;
        g.vel.y = Math.abs(g.vel.y) * 0.35;
      }
      if (g.fuse <= 0) {
        state.grenades.splice(i, 1);
        const p = g.mesh.position.clone();
        scene.remove(g.mesh);
        if (g.kind === 'frag') explodeGrenade(g);
        else if (g.kind === 'flash') flashBurst(p);
        else smokeBurst(p);
      }
    }

    // Spike countdown.
    if (state.spike.planted) {
      state.spike.timer -= dt;
      if (state.spike.timer <= 0) {
        state.spike.planted = false;
        effects.explosion(state.spike.position);
        audio.explosion();
        endRound('vanguard', 'Spike detonated');
      }
    }

    // Round timer.
    if (state.phase === 'buy') {
      state.timer -= dt;
      if (state.timer <= 0) startRound();
    } else if (state.phase === 'live') {
      // While the spike is armed the round runs until it detonates or is defused.
      if (!state.spike.planted) {
        state.timer -= dt;
        if (state.timer <= 0) endRound('warden', 'Time expired — Wardens held');
      }
    } else if (state.phase === 'roundEnd') {
      state.timer -= dt;
      if (state.timer <= 0) {
        hud.hideScoreboard();
        if (state.scoreV >= WIN_ROUNDS || state.scoreW >= WIN_ROUNDS || state.round >= MAX_ROUNDS) endMatch();
        else { state.round += 1; startBuyPhase(); }
      }
    }

    // HUD.
    weaponSet.step(dt, state.lastLookX, playerMover.groundSpeed());
    effects.step(dt);
    map.tick(dt);
    if (state.smokes.length) state.smokes = state.smokes.filter((s) => state.time <= s.until);
    // Head bob: phase advances with ground speed, amplitude eases in/out.
    const speed = playerMover.groundSpeed();
    state.bobPhase += dt * speed * 1.9;
    state.bobAmp += (Math.min(1, speed / 5.4) - state.bobAmp) * Math.min(1, dt * 8);
    hud.setHealth(player.hp, player.armor);
    ammoDisplay();
    hud.setSlots([
      { key: '1', label: player.primary ? WEAPONS[player.primary].name : 'Rifle', active: player.slot === 'primary', owned: !!player.primary },
      { key: '2', label: 'P9', active: player.slot === 'pistol', owned: true },
      { key: '3', label: 'Knife', active: player.slot === 'knife', owned: true },
      { key: '4', label: `Frag ${player.frags}`, active: player.slot === 'frag', owned: player.frags > 0 },
      { key: '5', label: `Flash ${player.flash}`, active: player.slot === 'flash', owned: player.flash > 0 },
      { key: '6', label: `Smoke ${player.smoke}`, active: player.slot === 'smoke', owned: player.smoke > 0 },
    ]);
    hud.setUtility(player.frags, player.flash, player.smoke);
    hud.setTimer(state.spike.planted ? state.spike.timer : state.timer, state.phase);
    hud.setScore(state.scoreV, state.scoreW, state.round);
    hud.setMoney(player.money);
    hud.setLocation(map.zoneAt(player.body.position.x, player.body.position.z));
    // Objective line: plant progress beats the default prompt.
    let objective = '';
    if (state.phase === 'live') {
      if (state.spike.planted) {
        const defuser = bots.bots.find((b) => b.alive && b.team === 'warden' && b.channelKind === 'defuse' && b.channel > 0.1);
        objective = defuser
          ? `${defuser.name.toUpperCase()} IS DEFUSING THE CHARGE — STOP THEM!`
          : `SPIKE PLANTED — defend it · ${Math.ceil(state.spike.timer)}s`;
      } else if (state.channelKind === 'plant') {
        objective = 'YOU ARE PLANTING THE CHARGE...';
      } else {
        const planter = bots.bots.find((b) => b.alive && b.channelKind === 'plant' && b.channel > 0.1);
        if (planter) objective = `${planter.name.toUpperCase()} IS PLANTING THE CHARGE...`;
        else if (player.alive) objective = 'PLANT THE DEVICE AT A OR B — hold E on a site';
      }
    }
    hud.setObjective(objective);
    const spreadPx = 6 + weaponSet.spread(playerMover.groundSpeed()) * 900;
    hud.setCrosshair(spreadPx, input.state.firing);
    hud.drawMinimap(player, agents, state.spike);
    for (const a of agents) if (!a.isPlayer) a.spottedUntil = Math.max(0, (a.spottedUntil || 0) - dt);
  }

  return {
    state, player, agents, FIXED,
    startMatch, startBuyPhase, buyItem, smokeBlocked,
    // Test/shot staging only: force a round end with a reason.
    debugEndRound(winner, reason) { endRound(winner, reason); },
    step,
    syncCamera(camera) {
      let eye, yaw, pitch;
      if (player.alive) {
        eye = player.body.position;
        yaw = player.body.yaw;
        pitch = player.body.pitch;
      } else if (state.spectate) {
        eye = state.spectate.body.position;
        yaw = state.spectate.body.yaw;
        pitch = 0;
      } else {
        eye = player.body.position;
        yaw = player.body.yaw;
        pitch = player.body.pitch;
      }
      const sh = state.shake;
      const bobY = Math.sin(state.bobPhase * 2) * 0.028 * state.bobAmp;
      const bobRoll = Math.sin(state.bobPhase) * 0.006 * state.bobAmp;
      camera.position.set(
        eye.x + (Math.random() - 0.5) * sh * 0.15,
        eye.y + (player.alive ? player.body.eye : 1.6) + bobY + (Math.random() - 0.5) * sh * 0.15,
        eye.z + (Math.random() - 0.5) * sh * 0.15,
      );
      camera.rotation.set(pitch + state.recoilPitch, yaw, bobRoll, 'YXZ');
    },
  };
}
