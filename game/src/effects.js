// Pooled hit feedback: tracers, impact sparks, explosions. Fixed pools, no
// allocations in the hot loop: every effect is a reused object with a life
// timer. Tracers are 1px lines on purpose: a box near the lens renders as a
// fat band across the frame, a line never does.
import * as THREE from 'three';

const TRACER_POOL = 24;
const SPARK_POOL = 16;
const DUST_POOL = 12;

export function createEffects(scene) {
  const tracers = [];
  for (let i = 0; i < TRACER_POOL; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffc266, transparent: true, opacity: 0 });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  const sparks = [];
  const sparkGeo = new THREE.OctahedronGeometry(0.06);
  for (let i = 0; i < SPARK_POOL; i += 1) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(sparkGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    sparks.push({ mesh, life: 0, vel: new THREE.Vector3() });
  }
  const boom = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, depthWrite: false }),
  );
  boom.visible = false;
  scene.add(boom);
  const boomLight = new THREE.PointLight(0xff8a30, 0, 30);
  scene.add(boomLight);
  let boomLife = 0;
  // Dust puffs: soft grey-brown spheres that bloom and fade on impacts.
  const dusts = [];
  const dustGeo = new THREE.SphereGeometry(0.32, 10, 8);
  for (let i = 0; i < DUST_POOL; i += 1) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x8a7a68, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(dustGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    dusts.push({ mesh, life: 0, max: 1 });
  }
  // One shared muzzle light for bot shots: it jumps to the firing bot and
  // dies out in a frame, so the surroundings catch the flash.
  const muzzleLight = new THREE.PointLight(0xffb13d, 0, 9);
  scene.add(muzzleLight);
  let muzzleLife = 0;

  // Ejected shell casings: small brass boxes that pop out, spin and fade.
  const SHELL_POOL = 10;
  const shells = [];
  const shellGeo = new THREE.BoxGeometry(0.03, 0.03, 0.07);
  const shellMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a227'), roughness: 0.35, metalness: 0.8 });
  for (let i = 0; i < SHELL_POOL; i += 1) {
    const mesh = new THREE.Mesh(shellGeo, shellMat);
    mesh.visible = false;
    scene.add(mesh);
    shells.push({ mesh, life: 0, vel: new THREE.Vector3(), spin: 0 });
  }
  let shellIdx = 0;

  // Lingering smoke clouds: big soft puffs that hang and block sight.
  const SMOKE_POOL = 8;
  const smokes = [];
  const smokeGeo = new THREE.SphereGeometry(1, 12, 10);
  for (let i = 0; i < SMOKE_POOL; i += 1) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xcfc8bd, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(smokeGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    smokes.push({ mesh, life: 0, max: 1 });
  }
  let smokeIdx = 0;

  const tmpDir = new THREE.Vector3();
  const tmpMid = new THREE.Vector3();

  let tracerIdx = 0;
  let sparkIdx = 0;
  let dustIdx = 0;

  function dust(point) {
    for (let n = 0; n < 2; n += 1) {
      const d = dusts[dustIdx];
      dustIdx = (dustIdx + 1) % DUST_POOL;
      d.mesh.position.copy(point);
      d.mesh.position.x += (Math.random() - 0.5) * 0.2;
      d.mesh.position.y += Math.random() * 0.15;
      d.mesh.position.z += (Math.random() - 0.5) * 0.2;
      d.mesh.scale.setScalar(0.5);
      d.mesh.material.opacity = 0.45;
      d.mesh.visible = true;
      d.max = 0.55 + Math.random() * 0.25;
      d.life = d.max;
    }
  }

  function muzzleFlash(point) {
    muzzleLight.position.copy(point);
    muzzleLight.intensity = 26;
    muzzleLife = 0.06;
  }

  function tracer(from, to, color = 0xffc266) {
    const t = tracers[tracerIdx];
    tracerIdx = (tracerIdx + 1) % TRACER_POOL;
    tmpDir.subVectors(to, from);
    const len = tmpDir.length();
    if (len < 0.1) return;
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.line.material.color.setHex(color);
    t.line.material.opacity = 0.75;
    t.line.visible = true;
    t.life = 0.07;
  }

  function impact(point, color = 0xffd27a) {
    dust(point);
    for (let n = 0; n < 3; n += 1) {
      const s = sparks[sparkIdx];
      sparkIdx = (sparkIdx + 1) % SPARK_POOL;
      s.mesh.position.copy(point);
      s.vel.set((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4);
      s.mesh.material.color.setHex(color);
      s.mesh.material.opacity = 1;
      s.mesh.visible = true;
      s.life = 0.25 + Math.random() * 0.15;
    }
  }

  function explosion(point) {
    boom.position.copy(point);
    boom.scale.setScalar(0.5);
    boom.material.opacity = 0.85;
    boom.visible = true;
    boomLight.position.copy(point);
    boomLight.position.y += 1;
    boomLight.intensity = 60;
    boomLife = 0.5;
  }

  function shell(from, right) {
    const s = shells[shellIdx];
    shellIdx = (shellIdx + 1) % SHELL_POOL;
    s.mesh.position.copy(from);
    s.vel.set(right.x * 1.4 + (Math.random() - 0.5) * 0.4, 1.6 + Math.random() * 0.6, right.z * 1.4 + (Math.random() - 0.5) * 0.4);
    s.spin = (Math.random() - 0.5) * 18;
    s.mesh.visible = true;
    s.life = 1.1;
  }

  // A smoke grenade bloom: several large puffs that hang for seconds.
  function smokeCloud(point, seconds = 12) {
    for (let n = 0; n < 5; n += 1) {
      const s = smokes[smokeIdx];
      smokeIdx = (smokeIdx + 1) % SMOKE_POOL;
      s.mesh.position.set(
        point.x + (Math.random() - 0.5) * 2.4,
        point.y + 0.9 + Math.random() * 1.2,
        point.z + (Math.random() - 0.5) * 2.4,
      );
      s.mesh.scale.setScalar(1.6 + Math.random() * 0.9);
      s.mesh.material.opacity = 0.55;
      s.mesh.visible = true;
      s.max = seconds;
      s.life = seconds;
    }
  }

  function step(dt) {
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.75;
      if (t.life <= 0) t.line.visible = false;
    }
    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.vel.y -= 12 * dt;
      s.mesh.material.opacity = Math.max(0, s.life / 0.4);
      if (s.life <= 0) s.mesh.visible = false;
    }
    if (boomLife > 0) {
      boomLife -= dt;
      const k = 1 - boomLife / 0.5;
      boom.scale.setScalar(0.5 + k * 6);
      boom.material.opacity = Math.max(0, 0.85 * (1 - k));
      boomLight.intensity = Math.max(0, 60 * (1 - k));
      if (boomLife <= 0) { boom.visible = false; boomLight.intensity = 0; }
    }
    for (const d of dusts) {
      if (d.life <= 0) continue;
      d.life -= dt;
      const k = 1 - d.life / d.max;
      d.mesh.scale.setScalar(0.5 + k * 1.6);
      d.mesh.material.opacity = Math.max(0, 0.45 * (1 - k));
      d.mesh.position.y += dt * 0.25;
      if (d.life <= 0) d.mesh.visible = false;
    }
    if (muzzleLife > 0) {
      muzzleLife -= dt;
      muzzleLight.intensity = Math.max(0, 26 * (muzzleLife / 0.06));
      if (muzzleLife <= 0) muzzleLight.intensity = 0;
    }
    for (const s of shells) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vel.y -= 12 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.spin * dt;
      s.mesh.rotation.z += s.spin * 0.7 * dt;
      if (s.mesh.position.y < 0.03) {
        s.mesh.position.y = 0.03;
        s.vel.set(0, 0, 0);
        s.spin = 0;
      }
      if (s.life <= 0) s.mesh.visible = false;
    }
    for (const s of smokes) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const k = 1 - s.life / s.max;
      s.mesh.scale.setScalar(1.6 + k * 1.4);
      s.mesh.material.opacity = Math.max(0, 0.55 * (1 - k * k));
      if (s.life <= 0) s.mesh.visible = false;
    }
  }

  return { tracer, impact, explosion, dust, muzzleFlash, shell, smokeCloud, step };
}
