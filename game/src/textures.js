// Procedural canvas textures only: no image files, no network. Each texture is
// drawn once at boot from a seeded generator so the map looks the same every run.
import * as THREE from 'three';

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

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function speckle(ctx, size, rand, colors, count, minR, maxR) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.12 + rand() * 0.25;
    const r = minR + rand() * (maxR - minR);
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function createTextures() {
  // Packed sand / asphalt ground with tire wear and cracks.
  const ground = canvasTexture(512, (ctx, s) => {
    const rand = seeded(11);
    ctx.fillStyle = '#6b5a48';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, ['#5a4a3a', '#7d6b55', '#4c3f31', '#8a7458'], 900, 1, 7);
    ctx.strokeStyle = 'rgba(40,30,20,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath();
      let x = rand() * s;
      let y = rand() * s;
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j += 1) {
        x += (rand() - 0.5) * 120;
        y += (rand() - 0.5) * 120;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // faint lane markings
    ctx.fillStyle = 'rgba(240,168,48,0.16)';
    ctx.fillRect(0, s * 0.48, s, 6);
    ctx.fillRect(s * 0.48, 0, 6, s);
  });

  // Weathered concrete wall with stains and a base trim.
  const wall = canvasTexture(256, (ctx, s) => {
    const rand = seeded(23);
    ctx.fillStyle = '#8a7f70';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, ['#7a6e60', '#97897a', '#6b6156'], 420, 1, 5);
    ctx.fillStyle = 'rgba(60,50,40,0.25)';
    for (let i = 0; i < 10; i += 1) {
      const w = 8 + rand() * 30;
      ctx.fillRect(rand() * s, rand() * s, w, 40 + rand() * 90);
    }
    ctx.fillStyle = '#5d5347';
    ctx.fillRect(0, s - 14, s, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, s, 4);
  });

  // Wooden crate planks with frame and nails.
  const crate = canvasTexture(256, (ctx, s) => {
    const rand = seeded(37);
    ctx.fillStyle = '#9a6b3f';
    ctx.fillRect(0, 0, s, s);
    for (let p = 0; p < 4; p += 1) {
      const y = p * 64;
      ctx.fillStyle = p % 2 ? '#94663a' : '#a17246';
      ctx.fillRect(0, y, s, 64);
      ctx.fillStyle = 'rgba(40,25,10,0.5)';
      ctx.fillRect(0, y, s, 3);
      ctx.fillRect(0, y + 61, s, 3);
      speckle(ctx, s, rand, ['#7d5432', '#b08250'], 40, 1, 3);
    }
    ctx.strokeStyle = '#6e4a28';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, s - 10, s - 10);
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.lineTo(s - 5, s - 5);
    ctx.moveTo(s - 5, 5);
    ctx.lineTo(5, s - 5);
    ctx.stroke();
    // Stenciled depot mark on every crate face.
    ctx.fillStyle = 'rgba(30,20,12,0.75)';
    ctx.font = 'bold 26px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DL-7', s / 2, s / 2 - 8);
    ctx.font = 'bold 17px ui-monospace, monospace';
    ctx.fillText('KEEP DRY', s / 2, s / 2 + 18);
  });

  // Corrugated container metal, tinted per site at material time.
  const container = canvasTexture(256, (ctx, s) => {
    const rand = seeded(51);
    ctx.fillStyle = '#7d838a';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      ctx.fillStyle = (x / 16) % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.16)';
      ctx.fillRect(x, 0, 8, s);
    }
    speckle(ctx, s, rand, ['#5c6167', '#8f959c', '#6a4a32'], 160, 1, 4);
    ctx.fillStyle = 'rgba(30,25,20,0.35)';
    ctx.fillRect(0, s - 10, s, 10);
  });

  // Hazard chevrons for site markers and the plant zone floor.
  const hazard = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#e8821e';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#1c1712';
    for (let i = -2; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 64, s);
      ctx.lineTo(i * 64 + 32, 0);
      ctx.lineTo(i * 64 + 64, 0);
      ctx.lineTo(i * 64 + 32, s);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Chain-link fence: dark grid on transparency.
  const fence = canvasTexture(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(200,205,210,0.85)';
    ctx.lineWidth = 2;
    for (let i = -s; i < s * 2; i += 16) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i + s, 0); ctx.lineTo(i, s); ctx.stroke();
    }
  });

  // Soft radial glow: sun disc and lamp halos.
  const glow = canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,190,110,0.95)');
    g.addColorStop(0.4, 'rgba(255,140,60,0.45)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  // Soft cloud blob, warm sunset tint.
  const cloud = canvasTexture(256, (ctx, s) => {
    const rand = seeded(77);
    for (let i = 0; i < 14; i += 1) {
      const x = s * 0.2 + rand() * s * 0.6;
      const y = s * 0.35 + rand() * s * 0.3;
      const r = 18 + rand() * 34;
      const g = ctx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, 'rgba(255,205,170,0.6)');
      g.addColorStop(1, 'rgba(255,205,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Wooden deck planks: long boards with gaps, nail heads and wear.
  const planks = canvasTexture(512, (ctx, s) => {
    const rand = seeded(91);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(0, 0, s, s);
    for (let p = 0; p < 8; p += 1) {
      const y = p * 64;
      ctx.fillStyle = p % 2 ? '#84643f' : '#93744a';
      ctx.fillRect(0, y, s, 64);
      ctx.fillStyle = 'rgba(40,25,10,0.55)';
      ctx.fillRect(0, y, s, 3);
      speckle(ctx, s, rand, ['#6e4f30', '#a37f52', '#5d4226'], 60, 1, 4);
      ctx.fillStyle = 'rgba(30,20,10,0.7)';
      for (let n = 0; n < 6; n += 1) {
        const x = 24 + n * 84 + rand() * 20;
        ctx.beginPath();
        ctx.arc(x, y + 10, 3, 0, Math.PI * 2);
        ctx.arc(x, y + 54, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  // Spray-paint graffiti: one big tag word, drips, bright on transparency.
  function graffiti(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 256);
    ctx.save();
    ctx.translate(256, 128);
    ctx.rotate(-0.06);
    ctx.font = 'bold 92px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
    ctx.fillStyle = color;
    const rand = seeded(text.length * 31 + 7);
    for (let i = 0; i < 10; i += 1) {
      const x = 60 + rand() * 392;
      const y = 150 + rand() * 60;
      ctx.globalAlpha = 0.35 + rand() * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, 2 + rand() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Painted sign board: site name + subtitle on a dark plate.
  function signBoard(lines, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(16,13,10,0.92)';
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 180);
    ctx.fillStyle = accent;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lines[0], 256, 66);
    ctx.fillStyle = '#efe9dc';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(lines[1], 256, 138);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Container stencil: faded painted label, e.g. "DL-051 · TERMINAL 7".
  function stencil(text, color = '#d8cfc0') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = color;
    ctx.font = 'bold 52px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.85;
    ctx.fillText(text, 256, 64);
    ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Giant site letter painted on a wall, weathered edge.
  function bigLetter(letter, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = color;
    ctx.font = 'bold 210px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.92;
    ctx.fillText(letter, 128, 140);
    ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  return { ground, wall, crate, container, hazard, fence, glow, cloud, planks, graffiti, signBoard, stencil, bigLetter };
}
