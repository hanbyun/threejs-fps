// DUSTLINE map: a dusk depot with two sites. Vanguard spawns south, Wardens
// north. Site A (east, amber crates) has a round silo; Site B (west, blue
// containers) has a pipe gantry. Nothing is a plain grid of cubes: walls run
// at angles, cover is round, stacked, tipped or beveled, the ground rolls,
// and pipes and cables cross overhead. Colliders stay simple axis-aligned
// boxes under the hood; the eye sees curves and angles.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createTextures } from './textures.js';

const tex = createTextures();

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.55, '#6b3f57');
  grad.addColorStop(0.78, PALETTE.skyHorizon);
  grad.addColorStop(1, '#d96a30');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function letterTexture(letter, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(20,16,12,0.55)';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = color;
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 68);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createMap(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const shootables = [];
  const rects = []; // top-down footprints for the minimap
  const ramps = []; // walkable slopes: { x, z, dx, dz, width, run, rise }

  const mats = {
    ground: new THREE.MeshStandardMaterial({ map: tex.ground, roughness: 0.95, metalness: 0 }),
    wall: new THREE.MeshStandardMaterial({ map: tex.wall, roughness: 0.9, metalness: 0.02 }),
    crate: new THREE.MeshStandardMaterial({ map: tex.crate, roughness: 0.85, metalness: 0 }),
    metal: new THREE.MeshStandardMaterial({ map: tex.container, roughness: 0.6, metalness: 0.35 }),
    metalA: new THREE.MeshStandardMaterial({ map: tex.container, color: new THREE.Color('#c97a2e'), roughness: 0.6, metalness: 0.35 }),
    metalB: new THREE.MeshStandardMaterial({ map: tex.container, color: new THREE.Color('#2e6fc2'), roughness: 0.6, metalness: 0.35 }),
    barrel: new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a2f24'), roughness: 0.55, metalness: 0.4 }),
    barrelY: new THREE.MeshStandardMaterial({ color: new THREE.Color('#a8842a'), roughness: 0.55, metalness: 0.4 }),
    hazard: new THREE.MeshStandardMaterial({ map: tex.hazard, roughness: 0.9, metalness: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: new THREE.Color('#232028'), roughness: 0.95 }),
    sand: new THREE.MeshStandardMaterial({ color: new THREE.Color('#a08b62'), roughness: 1, metalness: 0 }),
    rubber: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d1b19'), roughness: 0.95, metalness: 0 }),
    silo: new THREE.MeshStandardMaterial({ color: new THREE.Color('#b0703a'), roughness: 0.5, metalness: 0.55 }),
    pipe: new THREE.MeshStandardMaterial({ color: new THREE.Color('#5d6a6e'), roughness: 0.45, metalness: 0.6 }),
    pipeRust: new THREE.MeshStandardMaterial({ color: new THREE.Color('#7a4a28'), roughness: 0.6, metalness: 0.4 }),
    lampGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb45e') }),
    concrete: new THREE.MeshStandardMaterial({ color: new THREE.Color('#7d7468'), roughness: 0.92, metalness: 0 }),
    coneOrange: new THREE.MeshStandardMaterial({ color: new THREE.Color('#d8542e'), roughness: 0.7, metalness: 0 }),
    coneWhite: new THREE.MeshStandardMaterial({ color: new THREE.Color('#e8e4da'), roughness: 0.7, metalness: 0 }),
    leaf: new THREE.MeshStandardMaterial({ color: new THREE.Color('#4a7a3a'), roughness: 1, metalness: 0 }),
    pot: new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a4a2e'), roughness: 0.9, metalness: 0 }),
    windowWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a') }),
    windowAmber: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a4d') }),
    windowCool: new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fb8ff') }),
    flagCols: ['#e8821e', '#2e7fd6', '#f0a830', '#e83e8c', '#efe9dc'].map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c), side: THREE.DoubleSide })),
  };
  tex.ground.repeat.set(8, 6);
  tex.wall.repeat.set(2, 1);

  function register(mesh, solid) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (solid) {
      const bounds = new THREE.Box3().setFromObject(mesh);
      colliders.push(bounds);
      shootables.push(mesh);
      rects.push({ x: (bounds.min.x + bounds.max.x) / 2, z: (bounds.min.z + bounds.max.z) / 2, w: bounds.max.x - bounds.min.x, d: bounds.max.z - bounds.min.z });
    } else {
      shootables.push(mesh);
    }
    return mesh;
  }

  function box(w, h, d, x, y, z, mat, solid = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    return register(mesh, solid);
  }

  function addColliderBox(w, h, d, x, y, z) {
    const b = new THREE.Box3(
      new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
    );
    colliders.push(b);
    rects.push({ x, z, w, d });
    return b;
  }

  // An angled wall: the eye sees one rotated slab; the feet meet three
  // axis-aligned boxes stepping along its length.
  function diagWall(x1, z1, x2, z2, height, thick, mat) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const angle = Math.atan2(dx, dz);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    mesh.position.set(cx, height / 2, cz);
    mesh.scale.set(thick, height, len);
    mesh.rotation.y = angle;
    register(mesh, false);
    const steps = Math.max(2, Math.round(len / 2));
    for (let i = 0; i < steps; i += 1) {
      const t = (i + 0.5) / steps;
      addColliderBox(thick + 0.4, height, len / steps + 0.4, x1 + dx * t, height / 2, z1 + dz * t);
    }
    return mesh;
  }

  function cyl(r, h, x, z, mat, y = null, segments = 18) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), mat);
    mesh.position.set(x, y ?? h / 2, z);
    return register(mesh, true);
  }

  function crateAt(x, z, s = 1.1, h = null, rotY = 0, tip = false) {
    const hh = h ?? s;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats.crate);
    mesh.position.set(x, hh / 2, z);
    mesh.scale.set(s, hh, s);
    mesh.rotation.y = rotY;
    if (tip) {
      mesh.rotation.z = Math.PI / 2;
      mesh.position.y = s / 2;
      mesh.scale.set(s, s, s);
    }
    return register(mesh, true);
  }

  function containerAt(x, z, rotY, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    mesh.position.set(x, 1.25, z);
    mesh.rotation.y = rotY;
    mesh.scale.set(6, 2.5, 2.5);
    return register(mesh, true);
  }

  function barrelAt(x, z, mat) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 14), mat || mats.barrel);
    mesh.position.set(x, 0.53, z);
    return register(mesh, true);
  }

  function tireStack(x, z, n = 3) {
    const geo = new THREE.TorusGeometry(0.42, 0.16, 10, 20);
    for (let i = 0; i < n; i += 1) {
      const mesh = new THREE.Mesh(geo, mats.rubber);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x + (Math.random() - 0.5) * 0.08, 0.17 + i * 0.3, z + (Math.random() - 0.5) * 0.08);
      register(mesh, false);
    }
    addColliderBox(0.9, 0.35 * n, 0.9, x, 0.18 * n, z);
  }

  // Sandbag row with rounded tops: squashed spheres over a low box.
  function sandbags(x, z, len, angle) {
    const row = new THREE.Group();
    row.position.set(x, 0, z);
    row.rotation.y = angle;
    const n = Math.round(len / 0.55);
    const bagGeo = new THREE.SphereGeometry(0.32, 10, 8);
    for (let i = 0; i < n; i += 1) {
      const bag = new THREE.Mesh(bagGeo, mats.sand);
      bag.scale.set(1, 0.55, 0.75);
      bag.position.set(-len / 2 + (i + 0.5) * (len / n), 0.16 + (i % 2) * 0.26, (Math.random() - 0.5) * 0.08);
      bag.castShadow = true;
      bag.receiveShadow = true;
      row.add(bag);
      if (i % 2 === 0) {
        const top = new THREE.Mesh(bagGeo, mats.sand);
        top.scale.set(1, 0.55, 0.75);
        top.position.set(-len / 2 + (i + 0.5) * (len / n), 0.42, (Math.random() - 0.5) * 0.08);
        top.castShadow = true;
        row.add(top);
      }
    }
    group.add(row);
    const w = Math.abs(Math.cos(angle)) * len + Math.abs(Math.sin(angle)) * 0.6;
    const d = Math.abs(Math.sin(angle)) * len + Math.abs(Math.cos(angle)) * 0.6;
    addColliderBox(w, 0.7, d, x, 0.35, z);
    row.traverse((m) => { if (m.isMesh) shootables.push(m); });
    return row;
  }

  // Jersey barrier: wide base, narrow top — a bevel in two boxes.
  function jersey(x, z, angle, len = 2.4) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = angle;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats.concrete);
    base.scale.set(0.6, 0.55, len);
    base.position.y = 0.28;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats.concrete);
    top.scale.set(0.28, 0.5, len);
    top.position.y = 0.8;
    g.add(base, top);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; shootables.push(m); } });
    group.add(g);
    const w = Math.abs(Math.cos(angle)) * len + Math.abs(Math.sin(angle)) * 0.6;
    const d = Math.abs(Math.sin(angle)) * len + Math.abs(Math.cos(angle)) * 0.6;
    addColliderBox(w, 1.05, d, x, 0.53, z);
    return g;
  }

  // Horizontal pipe on posts, overhead or at knee height.
  function pipeRun(x1, z1, x2, z2, y, r, mat) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    mesh.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    mesh.rotation.z = Math.PI / 2;
    mesh.rotation.y = -Math.atan2(dz, dx);
    register(mesh, false);
    return mesh;
  }

  // A ramp the player can walk up: a visual slab over a smooth slope floor.
  // No collider boxes — the mover treats the slope as floor height, so the
  // climb is a smooth walk instead of a step the body cannot clear.
  function ramp(x, z, angle, width, rise, run) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = angle;
    const len = Math.hypot(rise, run);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats.concrete);
    slab.scale.set(width, 0.18, len);
    slab.position.set(0, rise / 2, 0);
    slab.rotation.x = -Math.atan2(rise, run);
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);
    shootables.push(slab);
    group.add(g);
    // dir points uphill (local +Z, toward the deck).
    ramps.push({ x, z, dx: Math.sin(angle), dz: Math.cos(angle), width, run, rise });
    // Hazard strip across the ramp base so the climb reads at a glance.
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.6), mats.hazard);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x - Math.sin(angle) * (run / 2 + 0.3), 0.03, z - Math.cos(angle) * (run / 2 + 0.3));
    strip.rotation.y = angle;
    strip.receiveShadow = true;
    group.add(strip);
    return g;
  }

  // Raised platform: deck on legs with a ramp up.
  function platform(x, z, w, d, height, rampAngle) {
    const deck = box(w, 0.25, d, x, height, z, mats.metal);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      cyl(0.09, height, x + lx * (w / 2 - 0.3), z + lz * (d / 2 - 0.3), mats.pipe, height / 2, 8);
    }
    // Rail on the far edge so it reads as a deck, not a block.
    box(w, 0.08, 0.08, x, height + 0.55, z - d / 2 + 0.05, mats.pipe, false);
    box(0.08, 0.55, 0.08, x - w / 2 + 0.05, height + 0.28, z - d / 2 + 0.05, mats.pipe, false);
    box(0.08, 0.55, 0.08, x + w / 2 - 0.05, height + 0.28, z - d / 2 + 0.05, mats.pipe, false);
    ramp(x, z + d / 2 + 1.6, rampAngle, Math.min(2.2, w - 0.6), height + 0.125, 3.2);
    return deck;
  }

  // Doorframe arch: two posts and a half-torus top.
  function arch(x, z, angle, width = 3.4, height = 3.4) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = angle;
    const postGeo = new THREE.BoxGeometry(0.4, height, 0.4);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, mats.wall);
      post.position.set(s * width / 2, height / 2, 0);
      post.castShadow = true;
      post.receiveShadow = true;
      g.add(post);
      shootables.push(post);
    }
    const arc = new THREE.Mesh(new THREE.TorusGeometry(width / 2, 0.22, 10, 20, Math.PI), mats.wall);
    arc.position.set(0, height, 0);
    arc.castShadow = true;
    g.add(arc);
    shootables.push(arc);
    group.add(g);
    const w = Math.abs(Math.cos(angle)) * (width + 0.8) + Math.abs(Math.sin(angle)) * 0.8;
    const d = Math.abs(Math.sin(angle)) * (width + 0.8) + Math.abs(Math.cos(angle)) * 0.8;
    // Colliders only under the posts, so the doorway stays open.
    const px = Math.cos(angle) * width / 2;
    const pz = -Math.sin(angle) * width / 2;
    addColliderBox(0.5, height, 0.5, x + px, height / 2, z + pz);
    addColliderBox(0.5, height, 0.5, x - px, height / 2, z - pz);
    return g;
  }

  // ---- Ground: a gently rolling plane, not a flat slab ----
  const groundGeo = new THREE.PlaneGeometry(64, 44, 32, 22);
  {
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const gx = pos.getX(i);
      const gy = pos.getY(i);
      pos.setZ(i, 0.08 * Math.sin(gx * 0.35 + 1.7) * Math.cos(gy * 0.3 - 0.6) + 0.05 * Math.sin(gx * 0.9) * Math.sin(gy * 0.7));
    }
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Sky dome, sun disc + glow, clouds, distant skyline. The sun sits low
  // in the north-west so it is in frame when the player looks up the map.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(160, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(7, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0'), fog: false }),
  );
  sunDisc.position.set(-52, 26, -110);
  sunDisc.lookAt(0, 4, 0);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshBasicMaterial({ map: tex.glow, transparent: true, depthWrite: false, fog: false }),
  );
  sunGlow.position.set(-52, 26, -108);
  sunGlow.lookAt(0, 4, 0);
  scene.add(sunGlow);
  const cloudMat = new THREE.MeshBasicMaterial({ map: tex.cloud, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
  const clouds = [];
  for (const [cx, cy, cz, s] of [[-40, 42, -60, 42], [30, 48, -70, 55], [55, 38, 40, 38], [-55, 44, 50, 46], [-10, 52, -80, 60], [60, 46, -40, 44], [-70, 40, -20, 40]]) {
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.42), cloudMat);
    cloud.position.set(cx, cy, cz);
    cloud.lookAt(0, 10, 0);
    scene.add(cloud);
    clouds.push(cloud);
  }
  for (const [x, z, w, h] of [[-46, -30, 10, 16], [-20, -40, 14, 22], [8, -44, 10, 13], [34, -34, 12, 19], [48, 6, 10, 14], [-48, 14, 12, 11], [44, 26, 10, 9]]) {
    const sil = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), mats.dark);
    sil.position.set(x, h / 2 - 0.5, z);
    group.add(sil);
  }

  // ---- Landmarks: ferris wheel + helicopter over the north skyline ----
  const wheel = new THREE.Group();
  wheel.position.set(-52, 14, -52);
  {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.35, 8, 32), mats.dark);
    wheel.add(rim);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.25, 8, 24), mats.dark);
    wheel.add(inner);
    for (let i = 0; i < 8; i += 1) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 18, 0.3), mats.dark);
      spoke.rotation.z = (i / 8) * Math.PI;
      wheel.add(spoke);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1), mats.dark);
      const a = (i / 8) * Math.PI * 2;
      cabin.position.set(Math.cos(a) * 9, Math.sin(a) * 9, 0);
      wheel.add(cabin);
    }
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 15, 0.5), mats.dark);
      leg.position.set(s * 4, -7.5, 0);
      leg.rotation.z = s * 0.25;
      wheel.add(leg);
    }
  }
  scene.add(wheel);
  // Helicopter: dark body, tail boom, spinning main rotor; crosses the sky.
  const heli = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 1.4), mats.dark);
    heli.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 0.4), mats.dark);
    tail.position.set(2.4, 0.3, 0);
    heli.add(tail);
    const skid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.2), mats.dark);
    skid.position.set(0, -0.8, 0);
    heli.add(skid);
  }
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.08, 0.3), mats.dark);
  rotor.position.y = 0.85;
  heli.add(rotor);
  const heliLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5040') }),
  );
  heliLight.position.set(-1.2, -0.7, 0);
  heli.add(heliLight);
  heli.position.set(-80, 34, -58);
  scene.add(heli);
  let heliX = -80;

  // String lights across mid: sagging line + warm bulbs.
  function stringLights(x1, y1, z1, x2, y2, z2) {
    const pts = [];
    const bulbs = [];
    const n = 14;
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const sag = Math.sin(t * Math.PI) * 0.9;
      pts.push(new THREE.Vector3(
        x1 + (x2 - x1) * t,
        y1 + (y2 - y1) * t - sag,
        z1 + (z2 - z1) * t,
      ));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x2a2118 }),
    );
    group.add(line);
    const bulbGeo = new THREE.SphereGeometry(0.09, 8, 6);
    for (let i = 1; i < n; i += 1) {
      const bulb = new THREE.Mesh(bulbGeo, mats.lampGlow);
      bulb.position.copy(pts[i]);
      group.add(bulb);
      bulbs.push(bulb);
    }
    return bulbs;
  }
  stringLights(-7.5, 4.5, -8, 7.5, 4.5, 8);
  stringLights(-12, 4.2, 2, -7.5, 4.5, -8);
  stringLights(12, 4.2, -2, 7.5, 4.5, 8);

  // Graffiti tags on the walls and containers.
  function graffitiPlane(text, color, w, x, y, z, rotY) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 2),
      new THREE.MeshBasicMaterial({ map: tex.graffiti(text, color), transparent: true, depthWrite: false }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    group.add(m);
    return m;
  }
  graffitiPlane('DUST', '#ff5a3c', 7, -20, 2.6, -21.9, 0);
  graffitiPlane('KRASH', '#e83e8c', 6, 30.5, 2.4, -12, -Math.PI / 2);
  graffitiPlane('DL', '#f0a830', 5, -32, 2.6, 4, Math.PI / 2);

  // Giant painted site letters on the north wall + depot signs over the pads.
  function bigLetterPlane(letter, color, x, z) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ map: tex.bigLetter(letter, color), transparent: true, depthWrite: false }),
    );
    m.position.set(x, 3.2, z);
    group.add(m);
    return m;
  }
  bigLetterPlane('A', '#e8821e', 16, -21.9);
  bigLetterPlane('B', '#2e7fd6', -16, -21.9);
  function signPlane(lines, accent, w, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.375),
      new THREE.MeshBasicMaterial({ map: tex.signBoard(lines, accent), transparent: true }),
    );
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }
  signPlane(['SITE A', 'DUSTLINE DEPOT'], '#e8821e', 5, 23, 5.6, -20.4);
  signPlane(['SITE B', 'DUSTLINE DEPOT'], '#2e7fd6', 5, -23, 5.6, -20.4);
  // Stenciled container labels.
  function stencilPlane(text, w, x, y, z, rotY) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: tex.stencil(text), transparent: true, depthWrite: false }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    group.add(m);
    return m;
  }
  stencilPlane('DL-051 · TERMINAL 7', 5, 24, 1.7, -17.2, 0);
  stencilPlane('DL-117 · TERMINAL 7', 5, -24, 1.7, -17.2, 0);
  stencilPlane('DL-309 · KEEP DRY', 4.5, 28.5, 1.7, -10.6, Math.PI / 2);

  // ---- Extra dressing: more graffiti, posters, floor paint, ornaments ----
  function tagPlane(text, color, style, w, x, y, z, rotY) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 2),
      new THREE.MeshBasicMaterial({ map: tex.tag(text, color, style), transparent: true, depthWrite: false }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    group.add(m);
    return m;
  }
  function posterPlane(title, lines, accent, w, x, y, z, rotY) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 1.5),
      new THREE.MeshBasicMaterial({ map: tex.poster(title, lines, accent), transparent: true }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    group.add(m);
    return m;
  }
  function groundMarkPlane(kind, text, color, size, x, z, y = 0.05) {
    const mat = new THREE.MeshBasicMaterial({ map: tex.groundMark(kind, text, color), transparent: true, depthWrite: false });
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  function bunting(x1, y1, z1, x2, y2, z2) {
    const n = 12;
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * 0.55, z1 + (z2 - z1) * t));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2a2118 })));
    const shape = new THREE.Shape();
    shape.moveTo(-0.14, 0);
    shape.lineTo(0.14, 0);
    shape.lineTo(0, -0.34);
    shape.closePath();
    const flagGeo = new THREE.ShapeGeometry(shape);
    for (let i = 1; i < n; i += 1) {
      const f = new THREE.Mesh(flagGeo, mats.flagCols[i % mats.flagCols.length]);
      f.position.copy(pts[i]);
      f.rotation.y = Math.atan2(z2 - z1, x2 - x1);
      group.add(f);
    }
  }
  function lantern(x, y, z, color, hangY = null) {
    if (hangY !== null) {
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, hangY - y, 4), mats.dark);
      line.position.set(x, (hangY + y) / 2, z);
      group.add(line);
    }
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }));
    body.scale.set(1, 0.85, 1);
    body.position.set(x, y, z);
    group.add(body);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: tex.glow, transparent: true, depthWrite: false, opacity: 0.7 }));
    halo.position.set(x, y, z);
    halo.lookAt(0, y, 0);
    group.add(halo);
    return body;
  }
  function coneAt(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.44), mats.rubber);
    base.position.y = 0.025;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.5, 12), mats.coneOrange);
    body.position.y = 0.3;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.155, 0.1, 12), mats.coneWhite);
    band.position.y = 0.32;
    g.add(base, body, band);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    group.add(g);
    return g;
  }
  function plantAt(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const potM = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 12), mats.pot);
    potM.position.y = 0.25;
    g.add(potM);
    const leafGeo = new THREE.SphereGeometry(0.3, 10, 8);
    for (const [ox, oy, oz, s] of [[0, 0.72, 0, 1], [0.2, 0.6, 0.1, 0.75], [-0.18, 0.62, -0.08, 0.7]]) {
      const leaf = new THREE.Mesh(leafGeo, mats.leaf);
      leaf.position.set(ox, oy, oz);
      leaf.scale.setScalar(s);
      g.add(leaf);
    }
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    group.add(g);
    return g;
  }
  function bannerPole(x, z, text, accent) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.6, 8), mats.pipe);
    pole.position.set(x, 2.3, z);
    register(pole, false);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.08), mats.pipe);
    arm.position.set(x, 4.45, z);
    register(arm, false);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 3),
      new THREE.MeshBasicMaterial({ map: tex.banner(text, accent), side: THREE.DoubleSide }),
    );
    banner.position.set(x, 2.9, z);
    group.add(banner);
    addColliderBox(0.25, 4.6, 0.25, x, 2.3, z);
    return banner;
  }
  const fans = [];
  function fanAt(x, y, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), mats.dark);
    g.add(disc);
    const blades = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const holder = new THREE.Group();
      holder.rotation.z = (i / 3) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.03), mats.metal);
      blade.position.y = 0.32;
      holder.add(blade);
      blades.add(holder);
    }
    g.add(blades);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mats.metal);
    hub.position.z = 0.05;
    g.add(hub);
    group.add(g);
    fans.push(blades);
    return g;
  }
  function ventPlane(x, y, z, rotY) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshStandardMaterial({ map: tex.vent(), roughness: 0.8, metalness: 0.3 }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    group.add(m);
    return m;
  }
  function lightPool(x, z, size, opacity) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex.glow, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.06, z);
    group.add(m);
    return m;
  }
  function shaft(x, z, r, height, opacity) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, height, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb45e'), transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.set(x, height / 2, z);
    group.add(cone);
    return cone;
  }
  function windowPane(x, y, z, rotY, mat) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    group.add(m);
    return m;
  }
  function cable(x1, y1, z1, x2, y2, z2, sag = 0.6) {
    const pts = [];
    const n = 12;
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * sag, z1 + (z2 - z1) * t));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x1a1512 })));
  }

  // More spray tags, every style, on walls, containers and the silo.
  tagPlane('RUST', '#ffd23e', 'bubble', 6, 8, 2.8, -21.9, 0);
  tagPlane('VANDAL', '#4dd0e1', 'stencil', 6, -8, 2.2, -21.9, 0);
  tagPlane('07', '#ff8a3c', 'wild', 5, 30.9, 3.0, 6, -Math.PI / 2);
  tagPlane('KEEP OUT', '#ff5040', 'stencil', 5, -30.9, 2.5, -6, Math.PI / 2);
  tagPlane('HAUL', '#7ee081', 'bubble', 5, 18, 1.9, -17.2, 0);
  tagPlane('SCRAP', '#e8b4ff', 'wild', 5, -18, 1.9, -17.2, 0);
  tagPlane('OIL', '#c9c9c9', 'stencil', 4, 27.5, 1.8, -14.2, 0);
  tagPlane('A LONG', '#f0a830', 'stencil', 4.5, 12.31, 2.2, 0, Math.PI / 2);
  tagPlane('B LONG', '#7fb8ff', 'stencil', 4.5, -12.31, 2.2, 0, -Math.PI / 2);
  tagPlane('NO ENTRY', '#ff5040', 'bubble', 5, -14, 2.4, 21.9, Math.PI);
  tagPlane('GATE 7', '#ffd23e', 'stencil', 5, 14, 2.4, 21.9, Math.PI);
  tagPlane('DUSTLINE', '#ff5a3c', 'wild', 4, 7, 2.4, 21.9, Math.PI);
  // The big depot mural on the north wall, neon sign above it (flickers).
  {
    const mural = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.375), new THREE.MeshBasicMaterial({ map: tex.mural('DUSTLINE', '#ffd23e') }));
    mural.position.set(0, 2.2, -21.85);
    group.add(mural);
  }
  let neonMat = null;
  {
    neonMat = new THREE.MeshBasicMaterial({ map: tex.neonSign('TERMINAL 7', '#4dd0e1'), transparent: true });
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), neonMat);
    neon.position.set(0, 4.8, -21.85);
    group.add(neon);
  }
  // Flyers on the mid pillars and the north wall.
  posterPlane('WANTED', ['WARDEN CREW', 'REWARD $500'], '#d64545', 1.3, 3, 1.7, 0.72, 0);
  posterPlane('WANTED', ['VANGUARD CREW', 'REWARD $500'], '#f0a830', 1.3, -3, 1.7, 0.72, 0);
  posterPlane('SAFETY FIRST', ['HARD HAT AREA', 'NO SMOKING'], '#2e7fd6', 1.3, -12, 1.8, -21.9, 0);
  posterPlane('TONIGHT', ['LIVE AT THE DEPOT', 'DOORS 20:00'], '#e83e8c', 1.3, 12, 1.8, -21.9, 0);
  posterPlane('SHIFT ROTA', ['A TEAM 06:00', 'B TEAM 18:00'], '#7ee081', 1.3, 28, 1.8, -21.9, 0);
  // Floor paint: arrows to the sites, lane number, keep-clear zones.
  groundMarkPlane('arrowText', 'A', '#e8821e', 3.5, 12, 4);
  groundMarkPlane('arrowText', 'B', '#2e7fd6', 3.5, -12, 4);
  groundMarkPlane('arrow', null, '#d8cfc0', 3, 0, 12);
  groundMarkPlane('text', '07', '#d8cfc0', 3, 0, -4);
  groundMarkPlane('text', 'KEEP CLEAR', '#e8821e', 3.5, 23, -5.5, 0.09);
  groundMarkPlane('text', 'KEEP CLEAR', '#2e7fd6', 3.5, -23, -5.5, 0.09);
  groundMarkPlane('text', 'STOP', '#ff5040', 3, 0, 17);
  // Bunting across the site entrances and the spawn yard.
  bunting(18, 4.0, -6, 28, 4.0, -6);
  bunting(-28, 4.0, -6, -18, 4.0, -6);
  bunting(-8, 4.0, 16, 8, 4.0, 16);
  // Paper lanterns: three hanging off the mid string lights, two off the
  // B gantry beam, one off the A silo spout.
  lantern(-3.75, 3.55, -4, '#ff9a3c', 3.95);
  lantern(0, 3.5, 0, '#ff5040', 3.9);
  lantern(3.75, 3.55, 4, '#ff9a3c', 3.95);
  lantern(-25.5, 4.4, -9, '#ff5040', 5.2);
  lantern(-20.5, 4.4, -9, '#ff9a3c', 5.2);
  lantern(25.1, 2.1, -16.0, '#ff9a3c');
  // Traffic cones at lane edges and pad corners.
  coneAt(20, -6.5); coneAt(26, -6.5); coneAt(-20, -6.5); coneAt(-26, -6.5);
  coneAt(10, 16.5); coneAt(-10, 16.5); coneAt(30, -4); coneAt(-30, -4);
  // Potted plants at the spawn corners and the south wall.
  plantAt(-8, 20.6); plantAt(8, 20.6); plantAt(-30.5, 18.5); plantAt(30.5, 18.5);
  // Wall vents and spinning exhaust fans.
  ventPlane(10, 3.8, -21.9, 0);
  ventPlane(-10, 3.8, -21.9, 0);
  ventPlane(31.9, 3.5, 10, -Math.PI / 2);
  ventPlane(-31.9, 3.5, -10, Math.PI / 2);
  fanAt(-21, 4.0, -21.85, 0);
  fanAt(6, 4.0, 21.85, Math.PI);
  // Pipes and sagging cables along the walls.
  pipeRun(-30, -21.9, 30, -21.9, 4.6, 0.14, mats.pipeRust);
  pipeRun(-30, 21.9, 30, 21.9, 4.3, 0.14, mats.pipe);
  for (const px of [-28, -14, 14, 28]) {
    const vp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 10), px < 0 ? mats.pipeRust : mats.pipe);
    vp.position.set(px, 2.5, -21.95);
    register(vp, false);
  }
  cable(-28, 4.8, -21.8, 28, 4.8, -21.8, 0.7);
  cable(-28, 4.4, 21.8, 28, 4.4, 21.8, 0.7);
  // Banners on poles flanking both site entrances. The B pair stands on
  // the south edge of the B deck (z=-2.5), NOT at the entrance line z=-6:
  // the site-B capture camera sits at (-19, 0, -5), one metre from the
  // z=-6 pole, and its solid blue 1.5x3 m banner filled the sky.
  bannerPole(19, -6, 'SITE A', '#e8821e');
  bannerPole(27, -6, 'SITE A', '#e8821e');
  bannerPole(-19, -2.5, 'SITE B', '#2e7fd6');
  bannerPole(-27, -2.5, 'SITE B', '#2e7fd6');
  // Lit windows on the skyline silhouettes: the depot is lived in.
  {
    const rand = seeded(777);
    const winMats = [mats.windowWarm, mats.windowWarm, mats.windowAmber, mats.windowCool];
    for (const [bx, bz, bw, bh] of [[-46, -30, 10, 16], [-20, -40, 14, 22], [8, -44, 10, 13], [34, -34, 12, 19], [48, 6, 10, 14], [-48, 14, 12, 11], [44, 26, 10, 9]]) {
      for (let i = 0; i < 3; i += 1) {
        const mat = winMats[Math.floor(rand() * winMats.length)];
        const wy = 2 + rand() * Math.max(1, bh - 4);
        if (bz < 0) windowPane(bx + (rand() - 0.5) * (bw - 2), wy, bz + 3.06, 0, mat);
        else if (bz > 20) windowPane(bx + (rand() - 0.5) * (bw - 2), wy, bz - 3.06, Math.PI, mat);
        else if (bx > 0) windowPane(bx - 5.06, wy, bz + (rand() - 0.5) * 4, -Math.PI / 2, mat);
        else windowPane(bx + 6.06, wy, bz + (rand() - 0.5) * 4, Math.PI / 2, mat);
      }
    }
  }
  // Warm light pools under the lamps and at both sites, plus light shafts.
  lightPool(-7.5, -8, 7, 0.28);
  lightPool(7.5, 8, 7, 0.28);
  lightPool(23, -11, 8, 0.3);
  lightPool(-23, -11, 8, 0.3);
  lightPool(0, 0, 6, 0.16);
  shaft(23, -11, 2.8, 3.2, 0.05);
  shaft(-23, -11, 2.8, 3.2, 0.05);
  shaft(-23, -9, 3.4, 5.2, 0.04);
  const siteLightA = new THREE.PointLight(new THREE.Color('#ffb45e'), 12, 11);
  siteLightA.position.set(23, 3, -11);
  scene.add(siteLightA);
  const siteLightB = new THREE.PointLight(new THREE.Color('#ffb45e'), 12, 11);
  siteLightB.position.set(-23, 3, -11);
  scene.add(siteLightB);
  const midLight = new THREE.PointLight(new THREE.Color('#ff9a3c'), 8, 9);
  midLight.position.set(0, 3.4, 0);
  scene.add(midLight);

  // Wooden deck patches: mid lane and the B yard walk on planks.
  function deckPatch(x, z, w, d, rotY = 0) {
    const t = tex.planks.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 4, d / 4);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rotY;
    m.position.set(x, 0.03, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  deckPatch(0, -2, 12, 8);
  deckPatch(-23, -5, 8, 6);

  // Perimeter walls, 5 m high.
  box(64.8, 5, 0.6, 0, 2.5, -22.3, mats.wall);
  box(64.8, 5, 0.6, 0, 2.5, 22.3, mats.wall);
  box(0.6, 5, 44.8, -32.3, 2.5, 0, mats.wall);
  box(0.6, 5, 44.8, 32.3, 2.5, 0, mats.wall);

  // Lane dividers: angled runs, not straight fences, with gaps to cross mid.
  // West divider: diagonal in from the north, straight mid, diagonal out south.
  diagWall(-12, -22, -9.5, -8, 4, 0.6, mats.wall);
  box(0.6, 4, 8, -12, 2, 2, mats.wall);
  diagWall(-12, 12, -9.5, 22, 4, 0.6, mats.wall);
  // East divider: mirrored angles.
  diagWall(12, -22, 9.5, -10, 4, 0.6, mats.wall);
  box(0.6, 4, 8, 12, 2, 0, mats.wall);
  diagWall(12, 10, 9.5, 22, 4, 0.6, mats.wall);

  // Mid connector: two pillars, flanking low walls, and an arch over the lane.
  box(1.4, 4.4, 1.4, -3, 2.2, 0, mats.wall);
  box(1.4, 4.4, 1.4, 3, 2.2, 0, mats.wall);
  box(0.7, 1.15, 4.4, -5.5, 0.58, 0, mats.wall);
  box(0.7, 1.15, 4.4, 5.5, 0.58, 0, mats.wall);
  arch(0, -9.5, 0, 4.2, 3.6);
  crateAt(-6.5, -3.5, 1.1, null, 0.5);
  crateAt(6.5, 3.5, 1.1, null, -0.4);
  crateAt(-6.5, 3.5, 1.1, 2.2, 0.3);
  crateAt(6.5, -3.5, 1.1, 2.2, -0.6);

  // Overhead pipes crossing mid, high enough to walk under.
  pipeRun(-14, 4, 14, -4, 4.6, 0.28, mats.pipe);
  pipeRun(-14, -4, 14, 4, 4.9, 0.2, mats.pipeRust);
  // Lamp posts with warm glow at the mid arches.
  for (const [lx, lz] of [[-7.5, -8], [7.5, 8]]) {
    cyl(0.09, 4.4, lx, lz, mats.pipe, 2.2, 8);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mats.lampGlow);
    lamp.position.set(lx, 4.5, lz);
    group.add(lamp);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: tex.glow, transparent: true, depthWrite: false, opacity: 0.8 }));
    halo.position.set(lx, 4.5, lz);
    halo.lookAt(0, 4.5, 0);
    group.add(halo);
    // Visible light cone under the lamp head.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 4.4, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb45e'), transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.position.set(lx, 2.3, lz);
    group.add(cone);
    const light = new THREE.PointLight(new THREE.Color('#ffb45e'), 14, 13);
    light.position.set(lx, 4.3, lz);
    scene.add(light);
  }

  // ---- Site A: amber crate yard + round silo (signature landmark) ----
  containerAt(24, -18.5, 0, mats.metalA);
  containerAt(28.5, -12, Math.PI / 2, mats.metalA);
  containerAt(18, -18.5, 0, mats.metal);
  // The silo: a rusted cylinder with a dome cap and a pipe down its side.
  cyl(2.2, 7, 27.5, -16.5, mats.silo, 3.5, 24);
  {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.silo);
    dome.position.set(27.5, 7, -16.5);
    register(dome, false);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5.4, 10), mats.pipeRust);
    spout.position.set(25.1, 2.7, -16.5);
    register(spout, false);
  }
  crateAt(19, -9, 1.1, 2.2, 0.4);
  crateAt(20.2, -9, 1.1, null, 0.9);
  crateAt(27, -8, 1.1, 2.2, -0.3);
  crateAt(22, -14.5, 1.1, null, 0.7);
  crateAt(24.5, -14.5, 1.1, 2.2, 0.2);
  crateAt(21.5, -12, 1.1, null, 0, true); // tipped on its side
  barrelAt(17.5, -12.5);
  barrelAt(29, -16.5, mats.barrelY);
  tireStack(18.5, -6.5, 3);
  sandbags(21, -6.5, 4, 0);
  jersey(26.5, -6, 0.35);
  const padA = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), mats.hazard);
  padA.rotation.x = -Math.PI / 2;
  padA.position.set(23, 0.02, -11);
  padA.receiveShadow = true;
  group.add(padA);
  const signA = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: letterTexture('A', PALETTE.siteA), transparent: true }));
  signA.position.set(23, 4.6, -20.6);
  group.add(signA);
  // Raised deck at the east edge with a ramp up.
  platform(28.5, -1.5, 5, 4, 2.2, Math.PI);

  // ---- Site B: blue container yard + pipe gantry (signature landmark) ----
  containerAt(-24, -18.5, 0, mats.metalB);
  containerAt(-28.5, -12, Math.PI / 2, mats.metalB);
  containerAt(-18, -18.5, 0, mats.metal);
  containerAt(-24, -13.5, 0, mats.metalB);
  // Gantry: two legs, a top beam, hanging cables, and fat pipes along the yard.
  for (const gx of [-27, -19]) {
    cyl(0.16, 5.2, gx, -9, mats.pipe, 2.6, 10);
  }
  box(8.6, 0.5, 0.5, -23, 5.2, -9, mats.pipe);
  pipeRun(-27, -9.5, -19, -9.5, 4.4, 0.32, mats.pipeRust);
  pipeRun(-27, -8.5, -19, -8.5, 4.1, 0.24, mats.pipe);
  for (const cx of [-25.5, -23, -20.5]) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), mats.dark);
    cable.position.set(cx, 4.7, -9);
    group.add(cable);
  }
  crateAt(-19, -9, 1.1, 2.2, -0.5);
  crateAt(-20.2, -9, 1.1, null, 0.3);
  crateAt(-27, -8, 1.1, 2.2, 0.6);
  crateAt(-22, -15.5, 1.1, null, -0.8);
  crateAt(-26.5, -14, 1.1, null, 0, true); // tipped on its side
  barrelAt(-17.5, -12.5, mats.barrelY);
  barrelAt(-29, -16.5);
  tireStack(-18.5, -6.5, 2);
  sandbags(-21, -6.5, 4, 0);
  jersey(-26.5, -6, -0.3);
  const padB = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), mats.hazard);
  padB.rotation.x = -Math.PI / 2;
  padB.position.set(-23, 0.02, -11);
  padB.receiveShadow = true;
  group.add(padB);
  const signB = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: letterTexture('B', PALETTE.siteB), transparent: true }));
  signB.position.set(-23, 4.6, -20.6);
  group.add(signB);
  // Raised deck at the west edge with a ramp up.
  platform(-28.5, -1.5, 5, 4, 2.2, Math.PI);

  // South lanes: rotated crates, barrels, tires, sandbags, fences.
  crateAt(-24, 8, 1.1, 2.2, 0.7);
  crateAt(-24, 14, 1.1, null, -0.5);
  crateAt(24, 8, 1.1, 2.2, -0.6);
  crateAt(24, 14, 1.1, null, 0.4);
  crateAt(-6, 12, 1.1, null, 0.9);
  crateAt(6, 12, 1.1, null, -0.7);
  barrelAt(-9, 16);
  barrelAt(9, 16, mats.barrelY);
  tireStack(-8, 8, 2);
  tireStack(8, -8, 3);
  sandbags(-4.5, 15.5, 3.4, 0.12);
  sandbags(4.5, 15.5, 3.4, -0.1);
  // Chain-link fences along the south approaches.
  for (const [fx, fz, fa] of [[-14, 18.5, 0.15], [14, 18.5, -0.15]]) {
    const fence = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 2.2),
      new THREE.MeshStandardMaterial({ map: tex.fence, transparent: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5, alphaTest: 0.15 }),
    );
    fence.position.set(fx, 1.1, fz);
    fence.rotation.y = fa;
    fence.castShadow = true;
    group.add(fence);
    shootables.push(fence);
    for (const px of [-3.4, 0, 3.4]) {
      cyl(0.06, 2.2, fx + px * Math.cos(fa), fz - px * Math.sin(fa), mats.pipe, 1.1, 6);
    }
  }
  // North mid cover for defenders.
  crateAt(-6, -13, 1.1, 2.2, 0.4);
  crateAt(6, -13, 1.1, 2.2, -0.3);
  sandbags(-4.5, -16.5, 3.4, 0.1);
  sandbags(4.5, -16.5, 3.4, -0.12);
  jersey(0, -16.5, 0.2);
  // North platform for defenders to shoot over mid.
  platform(8, -18.5, 5, 3.5, 2.2, Math.PI);

  // Scattered debris: small rubble chunks off the main lanes.
  {
    const rand = seeded(99);
    const debrisGeo = new THREE.BoxGeometry(1, 1, 1);
    const debrisMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4a4038'), roughness: 1 });
    for (let i = 0; i < 26; i += 1) {
      const x = (rand() * 2 - 1) * 29;
      const z = (rand() * 2 - 1) * 19;
      if (Math.abs(x) < 3 && Math.abs(z) < 12) continue; // keep the mid lane clear
      const s = 0.12 + rand() * 0.3;
      const m = new THREE.Mesh(debrisGeo, debrisMat);
      m.scale.set(s, s * 0.5, s);
      m.position.set(x, s * 0.25, z);
      m.rotation.y = rand() * Math.PI;
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
  }

  // Lighting: strong warm sun, cool teal rim from the opposite side so
  // silhouettes separate from the dusk sky, dusk fog. The sun sits high
  // enough that the spawn yard is not drowned in the south wall's shadow.
  const hemi = new THREE.HemisphereLight(new THREE.Color('#8a7a9e'), new THREE.Color('#4a3826'), 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(new THREE.Color('#ff9a4d'), 3.2);
  sun.position.set(-30, 42, 26);
  sun.target.position.set(0, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -38;
  sun.shadow.camera.right = 38;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#3f8a9a'), 0.9);
  fill.position.set(24, 10, -24);
  scene.add(fill);
  scene.fog = new THREE.Fog(new THREE.Color('#503a38'), 55, 150);

  // Named zones for the HUD location label and bot radio callouts.
  const zones = [
    { x: 23, z: -11, r: 8, name: 'SITE A — DEPOT YARD' },
    { x: -23, z: -11, r: 8, name: 'SITE B — GANTRY YARD' },
    { x: 28.5, z: -1.5, r: 4.5, name: 'SITE A — EAST DECK' },
    { x: -28.5, z: -1.5, r: 4.5, name: 'SITE B — WEST DECK' },
    { x: 0, z: 0, r: 7, name: 'MID — LONG ARCH' },
    { x: 12, z: -8, r: 6, name: 'A LONG' },
    { x: -12, z: -8, r: 6, name: 'B LONG' },
    { x: 0, z: 17, r: 9, name: 'SOUTH YARD — SPAWN' },
    { x: 0, z: -17, r: 8, name: 'NORTH — DEFENDER SIDE' },
  ];
  function zoneAt(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const zn of zones) {
      const d = Math.hypot(zn.x - x, zn.z - z);
      if (d <= zn.r && d < bestD) { bestD = d; best = zn; }
    }
    return best ? best.name : 'MID — DEPOT';
  }

  // Animated landmarks: the wheel turns, the helicopter crosses the sky,
  // clouds drift. Called once per fixed step from the game loop.
  let animTime = 0;
  function tick(dt) {
    animTime += dt;
    wheel.rotation.z += dt * 0.05;
    heliX += dt * 3.2;
    if (heliX > 90) heliX = -90;
    heli.position.set(heliX, 34 + Math.sin(animTime * 0.5) * 1.2, -58);
    rotor.rotation.y = animTime * 28;
    heliLight.material.color.setHex(Math.floor(animTime * 2) % 2 ? 0xff5040 : 0x881a10);
    for (const c of clouds) {
      c.position.x += dt * 0.25;
      if (c.position.x > 90) c.position.x = -90;
    }
    for (const f of fans) f.rotation.z -= dt * 9;
    // Neon sign flicker: mostly steady, with a rare hard drop-out.
    if (neonMat) {
      const drop = Math.sin(animTime * 3.1) > 0.996 ? 0.35 : 1;
      neonMat.opacity = (0.85 + 0.15 * Math.sin(animTime * 9)) * drop;
    }
  }

  // Waypoint graph: nodes across lanes and sites, edges between neighbours.
  const nodes = [
    [0, 19], [0, 11], [0, 0], [0, -8], [0, -14],
    [-8, 0], [8, 0], [-8, -14], [8, -14],
    [-24, 14], [-24, 4], [-24, -6], [-23, -11],
    [24, 14], [24, 4], [24, -6], [23, -11],
    [-18, 10], [18, 10], [-6, -6], [6, -6],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [2, 6], [5, 19], [6, 20],
    [5, 9], [6, 13], [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16],
    [1, 17], [1, 18], [3, 7], [3, 8], [7, 11], [8, 15], [19, 10], [20, 14],
    [17, 9], [18, 13], [4, 7], [4, 8], [19, 2], [20, 2],
  ];
  const adjacency = nodes.map(() => []);
  for (const [a, b] of edges) {
    adjacency[a].push(b);
    adjacency[b].push(a);
  }
  const waypoints = { nodes: nodes.map(([x, z]) => new THREE.Vector3(x, 0, z)), adjacency };

  const sites = {
    A: { center: new THREE.Vector3(23, 0, -11), radius: 3.2, label: 'A' },
    B: { center: new THREE.Vector3(-23, 0, -11), radius: 3.2, label: 'B' },
  };
  const spawns = {
    vanguard: [
      new THREE.Vector3(-6, 0, 19.5), new THREE.Vector3(-3, 0, 20), new THREE.Vector3(0, 0, 19.5),
      new THREE.Vector3(3, 0, 20), new THREE.Vector3(6, 0, 19.5),
    ],
    warden: [
      new THREE.Vector3(-6, 0, -19.5), new THREE.Vector3(-3, 0, -20), new THREE.Vector3(0, 0, -19.5),
      new THREE.Vector3(3, 0, -20), new THREE.Vector3(6, 0, -19.5),
    ],
  };

  return { colliders, shootables, rects, ramps, waypoints, sites, spawns, group, zones, zoneAt, tick };
}
