// The DOM HUD: crosshair, health, ammo, timer, score, money, kill feed, radio
// log, buy menu, minimap, banners and overlays. It never touches the
// simulation; game.js pushes numbers in and reads the buy/play callbacks out.
const BUY_ITEMS = [
  { id: 'vex9', key: '2', name: 'Vex-9 SMG', price: 1500, desc: '30 rd · fast · close range' },
  { id: 'ar77', key: '3', name: 'AR-77 Rifle', price: 2700, desc: '25 rd · accurate · all-round' },
  { id: 'dm12', key: '4', name: 'DM-12 Marksman', price: 4100, desc: '5 rd · heavy · long range' },
  { id: 'frag', key: '5', name: 'Frag Grenade', price: 300, desc: 'Throw with G · blast radius' },
  { id: 'armor', key: '6', name: 'Plating', price: 650, desc: '50 armor · absorbs half damage' },
  { id: 'flash', key: '7', name: 'Flash Grenade', price: 200, desc: 'Throw with 5 · blinds on sight' },
  { id: 'smoke', key: '8', name: 'Smoke Grenade', price: 300, desc: 'Throw with 6 · blocks sight' },
];
const MAX_ROUNDS = 12;
const WIN_ROUNDS = 7;

export function createHud(map) {
  const $ = (id) => document.getElementById(id);
  const el = {
    crosshair: $('crosshair'), hitmarker: $('hitmarker'),
    healthNum: $('health-num'), healthBar: $('health-bar'),
    armorNum: $('armor-num'), armorBar: $('armor-bar'),
    ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'), weaponName: $('weapon-name'),
    slotBar: $('slot-bar'), utilLine: $('util-line'),
    timer: $('timer'), scoreV: $('score-v'), scoreW: $('score-w'), roundLabel: $('round-label'),
    phaseLabel: $('phase-label'), pipsV: $('pips-v'), pipsW: $('pips-w'),
    cash: $('cash'), killfeed: $('killfeed'), radio: $('radio'),
    banner: $('banner'), bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'), buyMenu: $('buy-menu'), buyList: $('buy-list'), buyMoney: $('buy-money'),
    minimap: $('minimap'), locLabel: $('loc-label'),
    channel: $('channel'), channelLabel: $('channel-label'),
    channelBar: $('channel-bar'), damage: $('damage'), overlay: $('overlay'),
    fadeEl: $('fade'), flashEl: $('flashbang'),
    objective: $('objective'),
    overlayTitle: $('overlay-title'), overlayCopy: $('overlay-copy'), playBtn: $('play'),
    scoreboard: $('scoreboard'), scoreRows: $('score-rows'), spec: $('spectate'),
  };
  const mctx = el.minimap.getContext('2d');
  const MAP_W = 64, MAP_H = 44;
  let hitTimer = 0;
  let bannerTimer = 0;
  let flashTimer = 0;
  let last = {
    hp: -1, armor: -1, mag: -1, res: -1, timer: -1, v: -1, w: -1, round: -1,
    money: -1, weapon: '', phase: '', loc: '', objective: '', slots: '', util: '',
  };

  function moneyFmt(n) { return `$${n.toLocaleString('en-US')}`; }

  function drawPips(pipsEl, wins) {
    let html = '';
    for (let i = 0; i < WIN_ROUNDS; i += 1) html += `<i class="${i < wins ? 'won' : ''}"></i>`;
    pipsEl.innerHTML = html;
  }

  function drawMinimap(player, agents, spike) {
    const W = el.minimap.width, H = el.minimap.height;
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = 'rgba(12,10,8,0.72)';
    mctx.fillRect(0, 0, W, H);
    const sx = W / MAP_W, sz = H / MAP_H;
    const px = (x) => (x + MAP_W / 2) * sx;
    const pz = (z) => (z + MAP_H / 2) * sz;
    // site pads
    mctx.fillStyle = 'rgba(232,130,30,0.5)';
    mctx.fillRect(px(20.5), pz(-13.5), 5 * sx, 5 * sz);
    mctx.fillStyle = 'rgba(46,127,214,0.5)';
    mctx.fillRect(px(-25.5), pz(-13.5), 5 * sx, 5 * sz);
    mctx.fillStyle = '#efe9dc';
    mctx.font = 'bold 13px system-ui, sans-serif';
    mctx.fillText('A', px(22), pz(-9.5));
    mctx.fillText('B', px(-24), pz(-9.5));
    // walls
    mctx.fillStyle = 'rgba(233,230,223,0.55)';
    for (const r of map.rects) mctx.fillRect(px(r.x - r.w / 2), pz(r.z - r.d / 2), Math.max(1, r.w * sx), Math.max(1, r.d * sz));
    // spike
    if (spike.planted) {
      mctx.fillStyle = '#ff4d2e';
      mctx.beginPath();
      mctx.arc(px(spike.position.x), pz(spike.position.z), 4, 0, Math.PI * 2);
      mctx.fill();
    }
    // agents
    for (const a of agents) {
      if (!a.alive) continue;
      const x = px(a.body.position.x), z = pz(a.body.position.z);
      if (a.isPlayer) {
        mctx.fillStyle = '#f0a830';
        mctx.save();
        mctx.translate(x, z);
        mctx.rotate(Math.PI - a.body.yaw);
        mctx.beginPath();
        mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath();
        mctx.fill();
        mctx.restore();
      } else if (a.team === 'vanguard') {
        mctx.fillStyle = '#f0a830';
        mctx.beginPath(); mctx.arc(x, z, 3.5, 0, Math.PI * 2); mctx.fill();
      } else if (a.spottedUntil > 0) {
        mctx.fillStyle = '#d64545';
        mctx.beginPath(); mctx.arc(x, z, 3.5, 0, Math.PI * 2); mctx.fill();
      }
    }
  }

  return {
    setHealth(hp, armor) {
      if (hp === last.hp && armor === last.armor) return;
      last.hp = hp; last.armor = armor;
      el.healthNum.textContent = String(Math.max(0, Math.ceil(hp)));
      el.healthBar.style.width = `${Math.max(0, hp)}%`;
      el.healthBar.classList.toggle('low', hp <= 30);
      el.armorNum.textContent = String(Math.max(0, Math.ceil(armor)));
      el.armorBar.style.width = `${Math.max(0, Math.min(100, (armor / 50) * 100))}%`;
    },
    setAmmo(mag, reserve, weapon) {
      if (mag === last.mag && reserve === last.res && weapon === last.weapon) return;
      last.mag = mag; last.res = reserve; last.weapon = weapon;
      el.ammoMag.textContent = String(mag);
      el.ammoReserve.textContent = reserve === '' ? '' : `/ ${reserve}`;
      el.weaponName.textContent = weapon;
    },
    setSlots(slots) {
      const key = slots.map((s) => `${s.key}:${s.label}:${s.active ? 1 : 0}:${s.owned ? 1 : 0}`).join('|');
      if (key === last.slots) return;
      last.slots = key;
      el.slotBar.innerHTML = '';
      for (const s of slots) {
        const span = document.createElement('span');
        span.className = `slot${s.active ? ' active' : ''}${s.owned ? '' : ' empty'}`;
        span.textContent = `${s.key} ${s.label}`;
        el.slotBar.appendChild(span);
      }
    },
    setUtility(frag, flash, smoke) {
      const key = `${frag}|${flash}|${smoke}`;
      if (key === last.util) return;
      last.util = key;
      el.utilLine.textContent = `FRAG ${frag} · FLASH ${flash} · SMOKE ${smoke}`;
    },
    setTimer(sec, phase) {
      const s = Math.max(0, Math.ceil(sec));
      if (s === last.timer) return;
      last.timer = s;
      el.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      el.timer.classList.toggle('buy', phase === 'buy');
    },
    setScore(v, w, round) {
      if (v === last.v && w === last.w && round === last.round) return;
      last.v = v; last.w = w; last.round = round;
      el.scoreV.textContent = String(v);
      el.scoreW.textContent = String(w);
      el.roundLabel.textContent = `ROUND ${round} / ${MAX_ROUNDS}`;
      drawPips(el.pipsV, v);
      drawPips(el.pipsW, w);
    },
    setPhase(label) {
      if (label === last.phase) return;
      last.phase = label;
      el.phaseLabel.textContent = label;
    },
    setLocation(name) {
      if (name === last.loc) return;
      last.loc = name;
      el.locLabel.textContent = name;
    },
    setObjective(text) {
      if (text === last.objective) return;
      last.objective = text;
      el.objective.textContent = text;
      el.objective.hidden = !text;
    },
    setMoney(n) {
      if (n === last.money) return;
      last.money = n;
      el.cash.textContent = moneyFmt(n);
      el.buyMoney.textContent = moneyFmt(n);
    },
    setCrosshair(spreadPx, firing) {
      el.crosshair.style.setProperty('--gap', `${spreadPx}px`);
      el.crosshair.classList.toggle('firing', firing);
    },
    hitMarker(killed, holdMs = 110) {
      el.hitmarker.classList.add('on');
      el.hitmarker.classList.toggle('kill', killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => el.hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    damageFlash() {
      el.damage.classList.remove('show');
      void el.damage.offsetWidth;
      el.damage.classList.add('show');
    },
    flashbang(strength) {
      el.flashEl.style.opacity = String(Math.min(1, strength));
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => { el.flashEl.style.opacity = '0'; }, 120);
    },
    fade() {
      // Smooth round transition: cut to black for one frame, then ease out.
      el.fadeEl.classList.add('on');
      requestAnimationFrame(() => requestAnimationFrame(() => el.fadeEl.classList.remove('on')));
    },
    killfeed(killer, victim, weapon, headshot) {
      const row = document.createElement('div');
      row.className = 'feed-row';
      const hs = headshot ? '<span class="hs">HS</span>' : '';
      row.innerHTML = `<span class="killer">${killer}</span><span class="w">${weapon}</span>${hs}<span class="victim">${victim}</span>`;
      el.killfeed.prepend(row);
      while (el.killfeed.children.length > 5) el.killfeed.lastChild.remove();
      setTimeout(() => row.remove(), 6000);
    },
    radio(name, role, text) {
      const row = document.createElement('div');
      row.className = 'radio-row';
      row.innerHTML = `<span class="tag">[RADIO]</span> <b>${name} (${role}):</b> ${text}`;
      el.radio.prepend(row);
      while (el.radio.children.length > 4) el.radio.lastChild.remove();
      setTimeout(() => row.remove(), 9000);
    },
    banner(title, sub, tone, holdMs = 2600) {
      el.bannerTitle.textContent = title;
      el.bannerSub.textContent = sub || '';
      el.banner.className = `show ${tone || ''}`;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { el.banner.className = ''; }, holdMs);
    },
    setChannel(label, frac) {
      if (!label) { el.channel.hidden = true; return; }
      el.channel.hidden = false;
      el.channelLabel.textContent = label;
      el.channelBar.style.width = `${Math.round(frac * 100)}%`;
    },
    showBuy(open, money, owned) {
      el.buyMenu.hidden = !open;
      if (!open) return;
      el.buyMoney.textContent = moneyFmt(money);
      el.buyList.innerHTML = '';
      for (const item of BUY_ITEMS) {
        const has = owned.includes(item.id);
        const afford = money >= item.price;
        const row = document.createElement('div');
        row.className = `buy-row${has ? ' owned' : ''}${!afford && !has ? ' poor' : ''}`;
        row.dataset.id = item.id;
        row.innerHTML = `<span class="buy-key">${item.key}</span><span class="buy-name">${item.name}</span><span class="buy-desc">${item.desc}</span><span class="buy-price">${has ? 'OWNED' : moneyFmt(item.price)}</span>`;
        el.buyList.appendChild(row);
      }
    },
    setSpectate(on, name) {
      el.spec.hidden = !on;
      if (on) el.spec.textContent = `YOU ARE DOWN — spectating ${name}`;
    },
    showScoreboard(rows, title) {
      el.scoreboard.hidden = false;
      el.scoreRows.innerHTML = '';
      const head = document.createElement('div');
      head.className = 'sb-head';
      head.innerHTML = `<span>${title || 'SCOREBOARD'}</span><span>K / D</span><span>$</span>`;
      el.scoreRows.appendChild(head);
      for (const r of rows) {
        const row = document.createElement('div');
        row.className = `sb-row ${r.team}`;
        row.innerHTML = `<span>${r.name}</span><span>${r.kills} / ${r.deaths}</span><span>${moneyFmt(r.money)}</span>`;
        el.scoreRows.appendChild(row);
      }
    },
    hideScoreboard() { el.scoreboard.hidden = true; },
    showOverlay(mode, title, copy, action) {
      el.overlayTitle.textContent = title;
      el.overlayCopy.textContent = copy;
      el.playBtn.textContent = action;
      el.overlay.hidden = false;
      el.overlay.dataset.mode = mode;
    },
    hideOverlay() { el.overlay.hidden = true; },
    onPlay(handler) { el.playBtn.addEventListener('click', handler); },
    onBuyClick(handler) { el.buyList.addEventListener('click', (e) => { const row = e.target.closest('.buy-row'); if (row) handler(row.dataset.id); }); },
    drawMinimap,
  };
}
