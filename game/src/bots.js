// Bot squad: 4 Vanguard + 4 Warden agents. Each bot runs a small state machine
// (patrol / hold / push / engage / retreat / plant / defuse), walks the map's
// waypoint graph with BFS, checks line of sight with a raycast, and shoots
// real hitscan rays with reaction delay and distance-based spread.
import * as THREE from 'three';
import { createBody } from './mover.js';
import { WEAPONS } from './weapons.js';
import { TEAM_COLORS } from './palette.js';

const NAMES_V = ['Rook', 'Havoc', 'Sable', 'Kite'];
const NAMES_W = ['Bastion', 'Frost', 'Warden', 'Onyx'];
const ROLES_V = { Rook: 'Entry', Havoc: 'Support', Sable: 'Lurk', Kite: 'Anchor' };
const ROLES_W = { Bastion: 'Anchor', Frost: 'Support', Warden: 'Entry', Onyx: 'Lurk' };
const EYE = 1.5;

function bfsPath(adjacency, from, to) {
  if (from === to) return [to];
  const prev = new Array(adjacency.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length) {
    const n = queue.shift();
    for (const m of adjacency[n]) {
      if (prev[m] !== -1) continue;
      prev[m] = n;
      if (m === to) {
        const path = [to];
        let cur = to;
        while (cur !== from) { cur = prev[cur]; path.unshift(cur); }
        return path;
      }
      queue.push(m);
    }
  }
  return [to];
}

function nearestNode(nodes, pos) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < nodes.length; i += 1) {
    const d = (nodes[i].x - pos.x) ** 2 + (nodes[i].z - pos.z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function angleTo(from, to) {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createBots(scene, map, shootables) {
  const { nodes, adjacency } = map.waypoints;
  const raycaster = new THREE.Raycaster();
  raycaster.far = 60;
  const tmpDir = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();
  const bots = [];

  const torsoGeo = new THREE.BoxGeometry(0.52, 0.72, 0.3);
  const headGeo = new THREE.SphereGeometry(0.16, 12, 10);
  const legGeo = new THREE.BoxGeometry(0.18, 0.72, 0.2);
  const gunGeo = new THREE.BoxGeometry(0.07, 0.1, 0.55);
  const visorGeo = new THREE.BoxGeometry(0.3, 0.06, 0.05);

  function buildMesh(team, name) {
    const color = new THREE.Color(TEAM_COLORS[team]);
    const dark = new THREE.Color('#23211f');
    const group = new THREE.Group();
    const torso = new THREE.Mesh(torsoGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.65 }));
    torso.position.y = 1.05;
    // Team-colored armband so the side reads at a glance.
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.34), new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), roughness: 0.5 }));
    band.position.y = 1.32;
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a582'), roughness: 0.7 }));
    head.position.y = 1.58;
    // Helmet band in the team color.
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    helmet.position.y = 1.68;
    const visor = new THREE.Mesh(visorGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color('#111111'), roughness: 0.2, metalness: 0.6 }));
    visor.position.set(0, 1.6, -0.15);
    const legL = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: dark, roughness: 0.8 }));
    legL.position.set(-0.14, 0.36, 0);
    const legR = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: dark, roughness: 0.8 }));
    legR.position.set(0.14, 0.36, 0);
    const gun = new THREE.Mesh(gunGeo, new THREE.MeshStandardMaterial({ color: dark, roughness: 0.5, metalness: 0.4 }));
    gun.position.set(0.2, 1.15, -0.3);
    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb13d'), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    flash.position.set(0.2, 1.15, -0.65);
    // Nameplate: canvas sprite with the bot's name, a health bar and a
    // team-color bar. Redrawn when the bot takes damage (see setHp).
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx2d = canvas.getContext('2d');
    function drawPlate(hpFrac) {
      ctx2d.clearRect(0, 0, 256, 64);
      ctx2d.fillStyle = 'rgba(12,10,8,0.65)';
      ctx2d.fillRect(0, 0, 256, 44);
      ctx2d.fillStyle = '#ffffff';
      ctx2d.font = 'bold 30px system-ui, sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText(name, 128, 24);
      ctx2d.fillStyle = hpFrac > 0.5 ? '#7fd67a' : hpFrac > 0.25 ? '#f0a830' : '#d64545';
      ctx2d.fillRect(0, 44, 256 * Math.max(0, hpFrac), 4);
      ctx2d.fillStyle = team === 'vanguard' ? '#f0a830' : '#d64545';
      ctx2d.fillRect(0, 48, 256, 6);
    }
    drawPlate(1);
    const plateTex = new THREE.CanvasTexture(canvas);
    plateTex.colorSpace = THREE.SRGBColorSpace;
    const nameplate = new THREE.Sprite(new THREE.SpriteMaterial({ map: plateTex, transparent: true, depthWrite: false }));
    nameplate.scale.set(1.7, 0.42, 1);
    nameplate.position.y = 1.98;
    nameplate.visible = false;
    group.add(torso, band, helmet, head, visor, legL, legR, gun, flash, nameplate);
    group.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
    return {
      group, torso, head, legL, legR, flash, nameplate,
      setHp(frac) { drawPlate(frac); plateTex.needsUpdate = true; },
    };
  }

  function makeBot(team, name, spawn) {
    const parts = buildMesh(team, name);
    scene.add(parts.group);
    const mover = createBody(map.colliders, spawn.x, spawn.z, map.ramps);
    mover.body.yaw = team === 'vanguard' ? 0 : Math.PI;
    const bot = {
      team, name, role: team === 'vanguard' ? ROLES_V[name] : ROLES_W[name],
      isPlayer: false, alive: true,
      hp: 100, armor: 0, money: 800, weapon: 'p9',
      body: mover.body, mover, parts,
      state: 'patrol', path: [], pathIdx: 0, targetNode: 0,
      site: null, holdNode: 0,
      enemy: null, lastSeen: new THREE.Vector3(), lastSeenAt: -99,
      reactAt: 0, burstLeft: 0, burstPause: 0, shotAt: 0, strafeDir: 1, strafeAt: 0,
      channel: 0, channelKind: null, stuckAt: 0, lastPos: new THREE.Vector3(),
      senseAt: Math.random() * 0.15, spottedUntil: 0, flashAt: 0, blindUntil: 0,
      radioAt: -99, plantAnnounced: false, defuseAnnounced: false,
      fall: 0, flinch: 0, peekAt: 4 + Math.random() * 4,
    };
    parts.torso.userData.agent = bot;
    parts.torso.userData.part = 'torso';
    parts.head.userData.agent = bot;
    parts.head.userData.part = 'head';
    shootables.push(parts.torso, parts.head);
    bots.push(bot);
    return bot;
  }

  for (let i = 0; i < 4; i += 1) makeBot('vanguard', NAMES_V[i], map.spawns.vanguard[i + 1]);
  for (let i = 0; i < 4; i += 1) makeBot('warden', NAMES_W[i], map.spawns.warden[i + 1]);

  function buy(bot) {
    const roll = Math.random();
    if (bot.money >= 4100 && roll < 0.15) bot.weapon = 'dm12';
    else if (bot.money >= 2700 && roll < 0.55) bot.weapon = 'ar77';
    else if (bot.money >= 1500 && roll < 0.85) bot.weapon = 'vex9';
    else bot.weapon = 'p9';
    if (bot.money >= 650 && Math.random() < 0.5) { bot.armor = 50; bot.money -= 650; }
    bot.money -= WEAPONS[bot.weapon].price;
  }

  function setPath(bot, node) {
    const from = nearestNode(nodes, bot.body.position);
    bot.path = bfsPath(adjacency, from, node);
    bot.pathIdx = 0;
  }

  function resetRound(round) {
    for (const bot of bots) {
      const spawn = bot.team === 'vanguard' ? map.spawns.vanguard[bots.indexOf(bot) % 4 + 1] : map.spawns.warden[bots.indexOf(bot) % 4 + 1];
      bot.body.position.copy(spawn);
      bot.body.velocity.set(0, 0, 0);
      bot.body.yaw = bot.team === 'vanguard' ? 0 : Math.PI;
      bot.hp = 100;
      bot.alive = true;
      bot.state = 'patrol';
      bot.enemy = null;
      bot.channel = 0;
      bot.channelKind = null;
      bot.blindUntil = 0;
      bot.plantAnnounced = false;
      bot.defuseAnnounced = false;
      bot.parts.setHp(1);
      bot.fall = 0;
      bot.flinch = 0;
      bot.peekAt = 4 + Math.random() * 4;
      bot.parts.group.rotation.set(0, bot.body.yaw, 0);
      bot.parts.group.position.copy(spawn);
      bot.parts.group.visible = true;
      bot.site = Math.random() < 0.55 ? 'A' : 'B';
      buy(bot);
      // Defenders hold near their site; attackers push to theirs.
      if (bot.team === 'warden') {
        const siteNodes = bot.site === 'A' ? [15, 16, 8] : [11, 12, 7];
        bot.holdNode = siteNodes[Math.floor(Math.random() * siteNodes.length)];
        setPath(bot, bot.holdNode);
      } else {
        const siteNode = bot.site === 'A' ? 16 : 12;
        setPath(bot, siteNode);
      }
    }
    void round;
  }

  function canSee(bot, enemy, now, smokeBlocked) {
    const from = tmpTarget.set(bot.body.position.x, bot.body.position.y + EYE, bot.body.position.z);
    const to = new THREE.Vector3(enemy.body.position.x, enemy.body.position.y + 1.2, enemy.body.position.z);
    const dist = from.distanceTo(to);
    if (dist > 52) return false;
    tmpDir.subVectors(to, from).normalize();
    raycaster.set(from, tmpDir);
    raycaster.far = dist;
    const hit = raycaster.intersectObjects(map.shootables, false)[0];
    if (hit) return false;
    // A smoke cloud between the two blocks the sightline.
    if (smokeBlocked && smokeBlocked(from, to)) return false;
    return true;
  }

  function faceToward(bot, target, dt, rate = 6) {
    const want = angleTo(bot.body.position, target);
    bot.body.yaw += Math.max(-rate * dt, Math.min(rate * dt, angleDiff(want, bot.body.yaw)));
  }

  function moveAlongPath(bot, dt, speed) {
    if (bot.pathIdx >= bot.path.length) return new THREE.Vector3();
    const node = nodes[bot.path[bot.pathIdx]];
    const dx = node.x - bot.body.position.x;
    const dz = node.z - bot.body.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.6) {
      bot.pathIdx += 1;
      return moveAlongPath(bot, dt, speed);
    }
    const wish = new THREE.Vector3(dx / dist, 0, dz / dist);
    // Stuck check: pushing toward a node but barely moving for a second.
    if (bot.body.position.distanceToSquared(bot.lastPos) > 0.25) {
      bot.lastPos.copy(bot.body.position);
      bot.stuckAt = 0;
    } else {
      bot.stuckAt += dt;
      if (bot.stuckAt > 1.0) {
        bot.stuckAt = 0;
        bot.lastPos.copy(bot.body.position);
        setPath(bot, Math.floor(Math.random() * nodes.length));
        return new THREE.Vector3();
      }
    }
    bot.mover.step(dt, wish, speed, false, false);
    faceToward(bot, node, dt, 4);
    return wish;
  }

  function step(dt, ctx) {
    const now = ctx.time;
    for (const bot of bots) {
      if (!bot.alive) {
        bot.parts.nameplate.visible = false;
        if (bot.fall < 1) {
          bot.fall = Math.min(1, bot.fall + dt / 0.4);
          bot.parts.group.rotation.x = -bot.fall * 1.45;
          bot.parts.group.position.y = -bot.fall * 0.06;
        }
        continue;
      }
      // Staged bots (screenshot mode) stand exactly where they were put.
      if (bot.still) {
        bot.parts.group.position.set(bot.body.position.x, bot.body.position.y, bot.body.position.z);
        bot.parts.group.rotation.y = bot.body.yaw;
        if (ctx.camera) bot.parts.nameplate.visible = bot.parts.group.position.distanceTo(ctx.camera.position) < 16;
        continue;
      }
      bot.flinch = Math.max(0, bot.flinch - dt * 3);
      const blinded = now < bot.blindUntil;
      // Sense: staggered LOS checks against every living enemy.
      bot.senseAt -= dt;
      if (bot.senseAt <= 0 && !blinded) {
        bot.senseAt = 0.15 + Math.random() * 0.05;
        const prevEnemy = bot.enemy;
        bot.enemy = null;
        for (const enemy of ctx.agents) {
          if (enemy === bot || !enemy.alive || enemy.team === bot.team) continue;
          if (canSee(bot, enemy, now, ctx.smokeBlocked)) {
            bot.enemy = enemy;
            bot.lastSeen.copy(enemy.body.position);
            bot.lastSeenAt = now;
            break;
          }
        }
        if (bot.enemy !== prevEnemy) {
          bot.reactAt = 0;
          bot.burstLeft = 0;
          bot.burstPause = 0;
        }
        // First contact with a new enemy: call it out on the radio.
        if (bot.enemy && !prevEnemy && ctx.radio && now - bot.radioAt > 12) {
          bot.radioAt = now;
          const zone = map.zoneAt(bot.enemy.body.position.x, bot.enemy.body.position.z);
          const foes = bot.team === 'vanguard' ? 'Wardens' : 'Vanguard';
          ctx.radio(bot, `${foes} spotted — ${zone}`);
        }
        if (!bot.enemy && now - bot.lastSeenAt < 2.5 && ctx.phase === 'live') {
          // Keep hunting the last seen spot briefly.
          bot.enemy = null;
        }
      }

      let wish = new THREE.Vector3();
      const def = WEAPONS[bot.weapon];

      if (bot.enemy && ctx.phase === 'live' && !blinded) {
        // Engage: strafe, face, fire in bursts after a reaction delay.
        bot.state = 'engage';
        bot.channel = 0;
        bot.channelKind = null;
        const target = bot.enemy;
        faceToward(bot, target.body.position, dt, 7);
        const dist = bot.body.position.distanceTo(target.body.position);
        if (bot.hp < 35) {
          // Badly hurt: break off and run.
          bot.state = 'retreat';
          const away = new THREE.Vector3().subVectors(bot.body.position, target.body.position).normalize();
          bot.mover.step(dt, away, 4.6, false, false);
        } else {
          bot.strafeAt -= dt;
          if (bot.strafeAt <= 0) {
            bot.strafeAt = 0.7 + Math.random() * 0.8;
            bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
          }
          const fwd = new THREE.Vector3(-Math.sin(bot.body.yaw), 0, -Math.cos(bot.body.yaw));
          const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
          const close = dist < 8 ? -0.6 : dist > 22 ? 0.6 : 0;
          wish.addScaledVector(fwd, close).addScaledVector(right, bot.strafeDir * 0.8).normalize();
          bot.mover.step(dt, wish, 3.6, false, false);
          if (bot.reactAt === 0) bot.reactAt = now + 0.35 + Math.random() * 0.35;
          if (now >= bot.reactAt) {
            bot.burstPause -= dt;
            if (bot.burstLeft <= 0 && bot.burstPause <= 0) {
              bot.burstLeft = 3 + Math.floor(Math.random() * 3);
              bot.burstPause = 0.5 + Math.random() * 0.6;
            }
            if (bot.burstLeft > 0 && now >= bot.shotAt) {
              bot.shotAt = now + def.gap;
              bot.burstLeft -= 1;
              ctx.botShoot(bot, target);
              bot.spottedUntil = now + 3;
              bot.flashAt = now + 0.06;
            }
          }
        }
      } else if (ctx.phase === 'live' && ctx.spike.planted && bot.team === 'warden') {
        // Defuse the planted spike.
        bot.state = 'defuse';
        const spikePos = ctx.spike.position;
        const dist = Math.hypot(spikePos.x - bot.body.position.x, spikePos.z - bot.body.position.z);
        if (dist > 1.6) {
          setPathIfNeeded(bot, spikePos);
          wish = moveAlongPath(bot, dt, 4.6);
        } else {
          bot.channel += dt;
          bot.channelKind = 'defuse';
          if (!bot.defuseAnnounced && ctx.radio) {
            bot.defuseAnnounced = true;
            ctx.radio(bot, `Defusing at Site ${ctx.spike.site} — cover me!`);
          }
          faceToward(bot, spikePos, dt);
          if (bot.channel >= 5) ctx.defuseDone(bot);
        }
      } else if (ctx.phase === 'live' && ctx.spike.planted && bot.team === 'vanguard') {
        // Guard the planted spike from a nearby node.
        bot.state = 'hold';
        const node = bot.site === 'A' ? 15 : 11;
        if (nearestNode(nodes, bot.body.position) !== node) setPath(bot, node);
        moveAlongPath(bot, dt, 3.4);
      } else if (ctx.phase === 'live' && bot.team === 'vanguard') {
        // Push to the assigned site, then plant.
        bot.state = 'push';
        const site = map.sites[bot.site];
        const dist = Math.hypot(site.center.x - bot.body.position.x, site.center.z - bot.body.position.z);
        if (!ctx.spike.planted && dist < site.radius) {
          bot.channel += dt;
          bot.channelKind = 'plant';
          if (!bot.plantAnnounced && ctx.radio) {
            bot.plantAnnounced = true;
            ctx.radio(bot, `Planting the charge at Site ${bot.site}!`);
          }
          faceToward(bot, site.center, dt);
          if (bot.channel >= 3) ctx.plantDone(bot);
        } else {
          const node = bot.site === 'A' ? 16 : 12;
          if (bot.pathIdx >= bot.path.length) setPath(bot, node);
          moveAlongPath(bot, dt, 4.4);
        }
      } else {
        // Patrol / hold. Defenders peek: every few seconds a holder shifts
        // to a neighbouring node instead of standing still like a turret.
        bot.state = bot.team === 'warden' ? 'hold' : 'patrol';
        if (bot.team === 'warden') {
          bot.peekAt -= dt;
          if (bot.peekAt <= 0) {
            bot.peekAt = 6 + Math.random() * 6;
            const cur = nearestNode(nodes, bot.body.position);
            const adj = adjacency[cur];
            if (adj.length) setPath(bot, adj[Math.floor(Math.random() * adj.length)]);
          }
        }
        if (bot.pathIdx >= bot.path.length) {
          const next = bot.team === 'warden' ? bot.holdNode : Math.floor(Math.random() * nodes.length);
          setPath(bot, next);
        }
        moveAlongPath(bot, dt, 3.2);
      }

      // Sync the mesh to the body; walk bob, flinch lean, idle sway.
      const speed = bot.mover.groundSpeed();
      bot.parts.group.position.set(bot.body.position.x, bot.body.position.y, bot.body.position.z);
      if (bot.state !== 'engage') bot.parts.group.rotation.y = bot.body.yaw;
      else bot.parts.group.rotation.y = bot.body.yaw;
      bot.parts.group.rotation.z = bot.flinch * 0.22;
      const bob = Math.min(1, speed / 4) * Math.sin(now * 11) * 0.08;
      bot.parts.legL.rotation.x = bob;
      bot.parts.legR.rotation.x = -bob;
      const idle = speed < 0.5 ? Math.sin(now * 1.8 + bot.body.position.x) * 0.03 : 0;
      bot.parts.torso.rotation.x = idle;
      bot.parts.flash.material.opacity = now < bot.flashAt ? 0.9 : 0;
      if (ctx.camera) bot.parts.nameplate.visible = bot.parts.group.position.distanceTo(ctx.camera.position) < 16;
    }
  }

  function setPathIfNeeded(bot, pos) {
    const node = nearestNode(nodes, pos);
    if (bot.pathIdx >= bot.path.length || bot.path[bot.path.length - 1] !== node) setPath(bot, node);
  }

  return {
    bots,
    step,
    resetRound,
    aliveCount(team) {
      return bots.filter((b) => b.alive && b.team === team).length;
    },
  };
}
