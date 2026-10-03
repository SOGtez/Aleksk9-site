/* Chat Survivors — 3D version.
   The rules are the same as the 2D original: the game still runs on a flat x/y board (units ≈ pixels of the
   2D version). three.js draws that board in 3D: x → X, y → Z, and things get a height (Y) for looks only.
   Models are built in Blender (blender/build_models.py) and loaded from /game/models/*.glb. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.random() * a.length | 0], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const OUT = '#0a0708';

// ---------- screen
const glc = $('gl'), fx = $('fx'), fctx = fx.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
const mobile = matchMedia('(pointer: coarse)').matches;

// ---------- three.js
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b090c');
scene.fog = new THREE.Fog('#0b090c', 1400, 3200);
const camera = new THREE.PerspectiveCamera(36, 1, 10, 6000);
const camBase = new THREE.Vector3(), camTarget = new THREE.Vector3();

scene.add(new THREE.HemisphereLight('#d7dcff', '#3a2228', 1.5));
const sun = new THREE.DirectionalLight('#fff4e8', 2.4);
sun.position.set(-260, 900, 380);
sun.castShadow = true;
sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 1.5;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight('#ff4a3a', 0.7);
rim.position.set(300, 300, -600);
scene.add(rim);

// Cartoon shading: 3 hard light steps, plus a black outline shell on every mesh.
const GRAD = new THREE.DataTexture(new Uint8Array([95, 170, 225, 255]), 4, 1, THREE.RedFormat);
GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: OUT, side: THREE.BackSide });

// ---------- arena (game units). Landscape screens get a wide room, phones held upright a tall one.
let W = 1000, H = 640;
const WALL = 18, DOORW = 96, WALLH = 46;
/* Models are drawn bigger than their hit circles so they read well from the camera (the rules use the circles). */
const VIS = 1.55;
function chooseArena() { if (VH > VW * 1.1) { W = 540; H = 880; } else { W = 1000; H = 640; } }
const wx = (x) => x - W / 2, wz = (y) => y - H / 2;

function resize() {
  DPR = Math.min(mobile ? 1.5 : 2, devicePixelRatio || 1); VW = innerWidth; VH = innerHeight;
  renderer.setPixelRatio(DPR); renderer.setSize(VW, VH, false);
  glc.style.width = fx.style.width = VW + 'px'; glc.style.height = fx.style.height = VH + 'px';
  fx.width = VW * DPR; fx.height = VH * DPR;
  camera.aspect = VW / VH; fitCamera();
}
/* Put the camera as close as it can be while the whole room (walls included) stays on screen under the HUD. */
function fitCamera() {
  const el = (VH > VW ? 56 : 49) * Math.PI / 180, dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
  camTarget.set(0, 0, H * 0.04);
  const pts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const h of [0, WALLH]) pts.push(new THREE.Vector3(sx * W / 2, h, sz * H / 2));
  const v = new THREE.Vector3();
  const fits = (d) => {
    camera.position.copy(camTarget).addScaledVector(dir, d); camera.lookAt(camTarget);
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    const top = 1 - 2 * (72 / VH), bottom = -1 + 2 * (58 / VH);
    return pts.every((p) => { v.copy(p).project(camera); return Math.abs(v.x) < 0.97 && v.y < top && v.y > bottom; });
  };
  let lo = 100, hi = 8000;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  fits(hi); camBase.copy(camera.position);
  const s = Math.max(W, H) / 2 + 120;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 100, far: 2500 });
  sun.shadow.camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- models
const MODEL_NAMES = ['aleks', 'lurker', 'spammer', 'backseat', 'troll', 'bomber', 'boss', 'crate', 'coin', 'heart', 'key', 'weaponbox'];
const TEMPLATES = {};
function outlineGeometry(geo, t) {
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
  if (!n) return g;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
  return g;
}
function prepTemplate(root) {
  const meshes = []; root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const m of meshes) {
    const src = m.material;
    const toon = new THREE.MeshToonMaterial({ color: src.color.clone(), gradientMap: GRAD,
      emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0), emissiveIntensity: src.emissiveIntensity ?? 1 });
    toon.name = src.name;
    m.material = toon; m.castShadow = true;
    const shell = new THREE.Mesh(outlineGeometry(m.geometry, 0.055), OUTLINE_MAT);
    shell.name = 'outline'; shell.userData.outline = true; m.add(shell);
  }
  return root;
}
async function loadModels(onProgress) {
  const loader = new GLTFLoader(); let done = 0;
  await Promise.all(MODEL_NAMES.map((n) => loader.loadAsync(`/game/models/${n}.glb`).then((g) => {
    TEMPLATES[n] = prepTemplate(g.scene); onProgress(++done / MODEL_NAMES.length);
  })));
}
/* A copy of a model with its own materials (so it can flash, glow or change colour on its own). */
function instance(name) {
  const o = TEMPLATES[name].clone(true), mats = [];
  o.traverse((c) => {
    if (c.isMesh && !c.userData.outline) {
      c.material = c.material.clone();
      c.material.userData.baseEmissive = c.material.emissive.clone();
      c.material.userData.baseIntensity = c.material.emissiveIntensity;
      mats.push(c.material);
    }
  });
  o.userData.mats = mats;
  return o;
}
function matsNamed(o, name) { return o.userData.mats.filter((m) => m.name === name); }
function setFlash(o, on) {
  if (o.userData.flashing === on) return; o.userData.flashing = on;
  for (const m of o.userData.mats) {
    if (on) { m.emissive.set('#ffffff'); m.emissiveIntensity = 0.85; }
    else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseIntensity; }
  }
}
function disposeInstance(o) { if (o.userData.mats) for (const m of o.userData.mats) m.dispose(); }
/* game angle a (in the x/y board) → rotation about Y that makes a model (facing +Z) look that way */
const faceAngle = (a) => Math.atan2(Math.cos(a), Math.sin(a));

// shared simple shapes
const SPHERE = new THREE.SphereGeometry(1, 12, 8), BOX = new THREE.BoxGeometry(1, 1, 1);
const basicMats = new Map();
function basicMat(color, extra) {
  const k = color + (extra ? JSON.stringify(extra) : '');
  if (!basicMats.has(k)) basicMats.set(k, new THREE.MeshBasicMaterial({ color, ...(extra || {}) }));
  return basicMats.get(k);
}

// ---------- room (floor, walls, doors)
const roomGroup = new THREE.Group(); scene.add(roomGroup);
const under = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshBasicMaterial({ color: '#070608' }));
under.rotation.x = -Math.PI / 2; under.position.y = -2; scene.add(under);
function floorTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) & 1 ? '#2a2430' : '#332c3a'; g.fillRect(x * 64, y * 64, 64, 64); }
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3;
  for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 128); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(128, i * 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}
const FLOOR_TEX = floorTexture();
const WALL_MAT = new THREE.MeshToonMaterial({ color: '#3a2e38', gradientMap: GRAD });
const WALL_TOP_MAT = new THREE.MeshToonMaterial({ color: '#4a3b47', gradientMap: GRAD });
let doorParts = {};
function addBlock(x0, y0, x1, y1, h, mat) {
  const m = new THREE.Mesh(BOX, mat); m.scale.set(x1 - x0, h, y1 - y0);
  m.position.set(wx((x0 + x1) / 2), h / 2, wz((y0 + y1) / 2)); m.castShadow = m.receiveShadow = true;
  const shell = new THREE.Mesh(BOX, OUTLINE_MAT); shell.scale.set(1 + 3 / (x1 - x0), 1 + 3 / h, 1 + 3 / (y1 - y0)); m.add(shell);
  roomGroup.add(m); return m;
}
function buildRoomMeshes() {
  for (const c of [...roomGroup.children]) { roomGroup.remove(c); c.traverse((o) => { if (o.material && o.material.userData && o.material.userData.own) o.material.dispose(); }); }
  const tex = FLOOR_TEX; tex.repeat.set(W / 112, H / 112);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: tex }));
  floor.material.userData.own = true; floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; roomGroup.add(floor);
  const g = DOORW / 2; doorParts = {};
  const sides = {
    top: () => { seg(0, 0, W, WALL, 'top', true); }, bottom: () => { seg(0, H - WALL, W, H, 'bottom', true); },
    left: () => { seg(0, 0, WALL, H, 'left', false); }, right: () => { seg(W - WALL, 0, W, H, 'right', false); },
  };
  function seg(x0, y0, x1, y1, name, horiz) {
    if (!room.doors.includes(name)) { addBlock(x0, y0, x1, y1, WALLH, WALL_MAT); return; }
    if (horiz) { addBlock(x0, y0, W / 2 - g, y1, WALLH, WALL_MAT); addBlock(W / 2 + g, y0, x1, y1, WALLH, WALL_MAT); }
    else { addBlock(x0, y0, x1, H / 2 - g, WALLH, WALL_MAT); addBlock(x0, H / 2 + g, x1, y1, WALLH, WALL_MAT); }
    const pm = new THREE.MeshToonMaterial({ color: '#5a3f4c', gradientMap: GRAD, emissive: new THREE.Color('#ffd166'), emissiveIntensity: 0 });
    pm.userData.own = true;
    const panel = horiz ? addBlock(W / 2 - g + 4, y0 + 3, W / 2 + g - 4, y1 - 3, WALLH * 0.82, pm) : addBlock(x0 + 3, H / 2 - g + 4, x1 - 3, H / 2 + g - 4, WALLH * 0.82, pm);
    const gm = new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    gm.userData.own = true;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? DOORW : 70, horiz ? 70 : DOORW), gm);
    glow.rotation.x = -Math.PI / 2;
    const d = doorPos(name);
    glow.position.set(wx(d.x + (name === 'left' ? 26 : name === 'right' ? -26 : 0)), 0.6, wz(d.y + (name === 'top' ? 26 : name === 'bottom' ? -26 : 0)));
    roomGroup.add(glow);
    const light = new THREE.PointLight('#ffd166', 0, 260, 1.6); light.position.set(wx(d.x), 40, wz(d.y)); roomGroup.add(light);
    doorParts[name] = { panel, pm, glow, gm, light };
  }
  for (const k of Object.keys(sides)) sides[k]();
}

// ---------- audio (same blips as the 2D version)
let ac = null; const audio = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ } } return ac; };
function beep(f, d = 0.06, type = 'square', v = 0.05, slide = 0) { const a = audio(); if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, a.currentTime); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), a.currentTime + d); g.gain.value = v; g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + d); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + d); }
const sfx = { shot: () => beep(900, 0.05, 'square', 0.025, -500), scatter: () => beep(500, 0.09, 'square', 0.04, -300), rocket: () => beep(180, 0.25, 'sawtooth', 0.05, -120), boom: () => beep(90, 0.35, 'sawtooth', 0.12, -60), laser: () => beep(1400, 0.04, 'sine', 0.02), hammer: () => beep(260, 0.1, 'triangle', 0.06, -180), flame: () => beep(200 + Math.random() * 100, 0.04, 'sawtooth', 0.012), hit: () => beep(700, 0.04, 'square', 0.03, 300), hurt: () => beep(160, 0.25, 'sawtooth', 0.1, -90), coin: () => { beep(1200, 0.06, 'sine', 0.05); setTimeout(() => beep(1600, 0.09, 'sine', 0.05), 50); }, heart: () => { beep(600, 0.1, 'triangle', 0.06); setTimeout(() => beep(900, 0.15, 'triangle', 0.06), 90); }, pickup: () => { beep(440, 0.08, 'triangle', 0.06); setTimeout(() => beep(660, 0.08, 'triangle', 0.06), 70); setTimeout(() => beep(880, 0.12, 'triangle', 0.06), 140); }, wave: () => { beep(520, 0.1, 'triangle', 0.06); setTimeout(() => beep(780, 0.14, 'triangle', 0.06), 100); }, dead: () => { beep(200, 0.4, 'sawtooth', 0.12, -150); setTimeout(() => beep(120, 0.6, 'sawtooth', 0.1, -80), 200); }, crate: () => beep(300, 0.08, 'square', 0.05, -150) };

// ---------- input
const keys = {};
addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase()) && e.target.tagName !== 'INPUT') e.preventDefault(); });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
const mouse = { x: 0, y: 0, on: false };
addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; });
let moveT = null, aimT = null;
glc.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; const s = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; if (e.clientX < VW / 2) moveT = s; else aimT = s; });
glc.addEventListener('pointermove', (e) => { for (const s of [moveT, aimT]) if (s && s.id === e.pointerId) { s.x = e.clientX; s.y = e.clientY; } });
const endT = (e) => { if (moveT && moveT.id === e.pointerId) moveT = null; if (aimT && aimT.id === e.pointerId) aimT = null; };
glc.addEventListener('pointerup', endT); glc.addEventListener('pointercancel', endT);
const ray = new THREE.Raycaster(), aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -21), hitPt = new THREE.Vector3(), ndc = new THREE.Vector2();
function mouseOnBoard() {
  ndc.set(mouse.x / VW * 2 - 1, -(mouse.y / VH) * 2 + 1); ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(aimPlane, hitPt) ? { x: hitPt.x + W / 2, y: hitPt.z + H / 2 } : null;
}

// ---------- data (same as the 2D version)
const WEAPONS = {
  pistol: { name: 'Timeout Pistol', hint: 'default', color: '#f4f4f5', cd: 0.26, fire: (a) => { bullet(a, 520, 1, '#f4f4f5', 3, 0); sfx.shot(); } },
  scatter: { name: 'Emote Spam', hint: 'scatter', color: '#ff9f0a', cd: 0.6, fire: (a) => { for (let i = -2; i <= 2; i++) bullet(a + i * 0.14, 470, 1, '#ff9f0a', 3, 0, 0.55); sfx.scatter(); } },
  pasta: { name: 'Copypasta', hint: 'ricochet', color: '#3fb5ff', cd: 0.38, fire: (a) => { bullet(a, 560, 2, '#3fb5ff', 4, 3); sfx.shot(); } },
  laser: { name: '/clear Laser', hint: 'beam · pierces', color: '#ff3b30', cd: 0, beam: true },
  rocket: { name: 'Raid Rocket', hint: 'splash', color: '#ff6b6b', cd: 0.95, fire: (a) => { const b = bullet(a, 300, 6, '#ff6b6b', 7, 0); b.splash = 85; sfx.rocket(); } },
  hammer: { name: 'Ban Hammer', hint: 'melee · knockback', color: '#ffffff', cd: 0.48, melee: true },
  flame: { name: 'Hype Flamethrower', hint: 'short range', color: '#ffb347', cd: 0.045, fire: (a) => { const b = bullet(a + rnd(-0.22, 0.22), rnd(260, 360), 0.6, pick(['#ffb347', '#ff6a00', '#ffd166']), rnd(4, 8), 0, 0.32); b.pierce = true; sfx.flame(); } },
  nuke: { name: 'Sub Bomb', hint: 'huge splash · slow', color: '#a13cff', cd: 2.1, fire: (a) => { const b = bullet(a, 190, 14, '#a13cff', 10, 0); b.splash = 170; sfx.rocket(); } },
};
const WKEYS = Object.keys(WEAPONS);
const ENEMY = {
  lurker: { r: 12, hp: 2, speed: 55, color: '#8d8da3', coin: 1 },
  spammer: { r: 9, hp: 1, speed: 140, color: '#ffc233', coin: 1 },
  backseat: { r: 11, hp: 3, speed: 75, color: '#4cc3ff', coin: 2, ranged: true },
  troll: { r: 17, hp: 8, speed: 65, color: '#b455ff', coin: 4 },
  bomber: { r: 11, hp: 2, speed: 120, color: '#ff5a4e', coin: 2, bomb: true },
  boss: { r: 34, hp: 120, speed: 45, color: '#ff3b30', coin: 40, boss: true },
};
const MODEL_FOR = { lurker: 'lurker', spammer: 'spammer', backseat: 'backseat', troll: 'troll', bomber: 'bomber', boss: 'boss' };
const chatterNames = ['xX_no_scope_Xx', 'fridgeguy', 'maya', 'r6_andy', 'sleepy', 'wesley', 'gato', 'tez', 'lunaa', 'pogchamp99', 'ratio_king', 'kyle', 'dani', 'bigL', 'nate_w', 'sunny'];
const killLines = ['banned', 'L', 'get out', 'ratio', 'KEKW', 'timed out', 'gone', 'bye', 'deleted'];
const adviceLines = ['just peek', 'use ur drone', 'ur bad', 'switch op', 'why no smoke'];

// ---------- state
let P, enemies, bullets, ebullets, parts, texts, drops, crates, running = false, t = 0, last = 0, spawnT = 0, crateT = 0, wave = 1, kills = 0, coins = 0, weaponsUsed, streak = 0, hurtT = 0, shake = 0, laserOn = false;
let room = null, quota, spawned, hasKey, fade = 0, fadeDir = 0, entryDoor = null;
const DOORS = { top: { x: () => W / 2, y: () => WALL / 2, h: true }, bottom: { x: () => W / 2, y: () => H - WALL / 2, h: true }, left: { x: () => WALL / 2, y: () => H / 2, h: false }, right: { x: () => W - WALL / 2, y: () => H / 2, h: false } };

function reset() {
  chooseArena(); fitCamera();
  P = { x: W / 2, y: H / 2, r: 14, hp: 5, maxHp: 5, dir: Math.PI / 2, weapon: 'pistol', cd: 0, swing: 0 };
  enemies = []; bullets = []; ebullets = []; parts = []; texts = []; drops = []; crates = [];
  t = 0; spawnT = 0; crateT = 6; wave = 1; kills = 0; coins = 0; streak = 0; hurtT = 0; shake = 0; weaponsUsed = new Set(['pistol']);
  setWeapon('pistol', true); entryDoor = null; fade = 0; fadeDir = 0; buildRoom(); hud();
}
function fmt(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${s < 10 ? '0' : ''}${s}`; }
function hud() {
  $('time').textContent = fmt(t);
  $('wave').textContent = `Room ${wave}`; $('left').textContent = room ? (room.cleared ? (hasKey ? 'Find the glowing door' : 'Grab the key') : `${Math.max(0, quota - kills + room.killsAtStart)} left`) : ''; $('coins').textContent = `◎ ${coins}`;
  const hp = $('hp'); hp.innerHTML = ''; for (let i = 0; i < P.maxHp; i++) { const d = document.createElement('i'); if (i >= P.hp) d.className = 'gone'; hp.appendChild(d); }
}
function banner(text) { const b = $('banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function setWeapon(k, silent) {
  P.weapon = k; P.cd = 0; const w = WEAPONS[k]; weaponsUsed.add(k);
  const tag = $('weaponTag'); tag.style.setProperty('--wcol', w.color); $('weaponName').textContent = w.name; $('weaponHint').textContent = w.hint;
  if (!silent) { tag.classList.remove('pop'); void tag.offsetWidth; tag.classList.add('pop'); sfx.pickup(); popText(P.x, P.y, w.name, w.color); }
}

// ---------- helpers
function bullet(a, speed, dmg, color, r, bounces, life = 1.6) { const b = { x: P.x + Math.cos(a) * 18, y: P.y + Math.sin(a) * 18, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg, color, r, bounces, life, splash: 0, pierce: false, hitSet: new Set() }; bullets.push(b); return b; }
function burst(x, y, color, n = 10, s = 180) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * s; parts.push({ x, y, h: rnd(8, 22), vh: rnd(80, 220), vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.35, color, r: 2 + Math.random() * 3 }); } }
function popText(x, y, text, color = '#fff') { texts.push({ x, y, h: 50, text, color, life: 1 }); }
function buildRoom() {
  const all = ['top', 'bottom', 'left', 'right'];
  const open = entryDoor ? all.filter((d) => d !== entryDoor) : all.slice();
  const n = Math.min(open.length, 2 + (Math.random() < 0.5 ? 1 : 0));
  const doors = []; while (doors.length < n) { const d = pick(open); if (!doors.includes(d)) doors.push(d); }
  if (entryDoor) doors.push(entryDoor);
  const exit = pick(doors.filter((d) => d !== entryDoor));
  const boss = wave % 5 === 0;
  room = { doors, exit, boss, cleared: false, unlocked: false, killsAtStart: kills };
  quota = boss ? 8 + wave : 10 + wave * 3; spawned = 0; hasKey = false;
  enemies = []; bullets = []; ebullets = []; drops = []; crates = [];
  for (let i = 0; i < (boss ? 1 : 2); i++) spawnCrate();
  spawnT = 0.6; crateT = 8;
  if (boss) { spawn('boss'); spawned++; }
  buildRoomMeshes();
  banner(boss ? `Room ${wave} — THE DOOMER` : `Room ${wave}`);
}
function doorPos(name) { const d = DOORS[name]; return { x: d.x(), y: d.y(), h: d.h }; }
function inDoorGap(name, x, y) { const d = doorPos(name); return d.h ? Math.abs(x - d.x) < DOORW / 2 : Math.abs(y - d.y) < DOORW / 2; }
function nextRoom() { fadeDir = 1; }
function enterNextRoom() {
  const came = room.exit; const opp = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[came];
  wave++; entryDoor = opp;
  chooseArena(); fitCamera();                         // a turned phone gets the right room shape from the next room on
  const d = doorPos(opp); P.x = d.h ? W / 2 : (opp === 'left' ? WALL + P.r + 10 : W - WALL - P.r - 10); P.y = d.h ? (opp === 'top' ? WALL + P.r + 10 : H - WALL - P.r - 10) : H / 2;
  buildRoom(); hud(); sfx.wave();
}
function spawn(type) {
  if (!type) { const r = Math.random(); type = 'lurker'; if (wave >= 2 && r < 0.3) type = 'spammer'; if (wave >= 3 && r > 0.72 && r < 0.86) type = 'backseat'; if (wave >= 4 && r >= 0.9) type = 'troll'; if (wave >= 6 && r >= 0.86 && r < 0.9) type = 'bomber'; }
  const d = ENEMY[type]; const choices = room.doors.filter((k) => k !== entryDoor); const dn = pick(choices.length ? choices : room.doors); const dp = doorPos(dn); const off = Math.random() * DOORW * 0.7 - DOORW * 0.35; const x = dp.h ? dp.x + off : (dn === 'left' ? -20 : W + 20); const y = dp.h ? (dn === 'top' ? -20 : H + 20) : dp.y + off;
  const hp = d.hp + (d.boss ? wave * 8 : Math.floor(wave / 4));
  enemies.push({ ...d, type, x, y, r: d.r, hp, maxHp: hp, speed: d.speed * (1 + wave * 0.025), color: d.color, name: d.boss ? 'THE DOOMER' : chatterNames[Math.random() * chatterNames.length | 0], flash: 0, wob: Math.random() * TAU, shotT: rnd(1, 2.5), slow: 0 });
}
function spawnCrate() {
  let x, y, tries = 0;                                   // not on top of Aleks or another crate
  do { x = rnd(WALL + 50, W - WALL - 50); y = rnd(WALL + 80, H - WALL - 60); } while (++tries < 20 && (Math.hypot(x - P.x, y - P.y) < 110 || crates.some((c) => Math.hypot(c.x - x, c.y - y) < 60)));
  crates.push({ x, y, r: 14, hp: 3, flash: 0 });
}
function drop(x, y, forceWeapon) {
  const r = Math.random();
  if (forceWeapon || r < 0.07) { const k = pick(WKEYS.filter((k) => k !== P.weapon)); drops.push({ x, y, kind: 'weapon', key: k, life: 14, r: 12 }); }
  else if (r < 0.11) drops.push({ x, y, kind: 'heart', life: 12, r: 10 });
  else if (r < 0.45) drops.push({ x, y, kind: 'coin', life: 12, r: 7 });
}
function damageEnemy(e, dmg, kx = 0, ky = 0) {
  e.hp -= dmg; e.flash = 0.1; e.x += kx; e.y += ky;
  if (e.hp <= 0) {
    const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
    kills++; streak++; burst(e.x, e.y, e.color, e.boss ? 60 : 12, e.boss ? 400 : 180);
    popText(e.x, e.y, `${e.name} ${pick(killLines)}`);
    if (e.bomb) explode(e.x, e.y, 70, 3, true);
    if (e.boss) { banner('DOOMER BANNED'); shake = 14; for (let i = 0; i < 5; i++) drop(e.x + rnd(-30, 30), e.y + rnd(-30, 30)); drop(e.x, e.y, true); coins += e.coin; hud(); }
    else { drop(e.x, e.y); if (Math.random() < 0.5) { coins += e.coin; hud(); } }
    if (spawned >= quota && enemies.length === 0 && !room.cleared) { room.cleared = true; drops.push({ x: clamp(e.x, WALL + 30, W - WALL - 30), y: clamp(e.y, WALL + 30, H - WALL - 30), kind: 'key', life: 9999, r: 12 }); banner('Room cleared — grab the key'); popText(e.x, e.y, 'dropped a key', '#ffd166'); hud(); }
    if (streak % 15 === 0) banner(streak >= 45 ? 'HE\'S UNBANNABLE' : streak >= 30 ? 'CLIP IT' : 'POGGERS');
    return true;
  }
  return false;
}
function explode(x, y, rad, dmg, hurtsPlayer) {
  burst(x, y, '#ff6b6b', 26, 320); shake = Math.max(shake, 6); sfx.boom();
  booms.push({ x, y, rad, life: 0.35 });
  for (const e of [...enemies]) { if (Math.hypot(e.x - x, e.y - y) < rad + e.r) damageEnemy(e, dmg, (e.x - x) * 0.15, (e.y - y) * 0.15); }
  for (const c of [...crates]) { if (Math.hypot(c.x - x, c.y - y) < rad + c.r) hitCrate(c, dmg); }
  if (hurtsPlayer && Math.hypot(P.x - x, P.y - y) < rad + P.r) hurt();
}
function hitCrate(c, dmg) { c.hp -= dmg; c.flash = 0.1; sfx.crate(); if (c.hp <= 0) { const i = crates.indexOf(c); if (i < 0) return; crates.splice(i, 1); burst(c.x, c.y, '#ffd166', 14); const r = Math.random(); if (r < 0.4) drop(c.x, c.y, true); else if (r < 0.65) drops.push({ x: c.x, y: c.y, kind: 'heart', life: 12, r: 10 }); else { for (let i = 0; i < 3; i++) drops.push({ x: c.x + rnd(-14, 14), y: c.y + rnd(-14, 14), kind: 'coin', life: 12, r: 7 }); } } }
function hurt() {
  if (hurtT > 0) return; P.hp--; hurtT = 1; streak = 0; sfx.hurt(); shake = 8;
  $('flash').classList.remove('go'); void $('flash').offsetWidth; $('flash').classList.add('go'); if (navigator.vibrate) navigator.vibrate(80);
  popText(P.x, P.y, pick(['oof', 'ratio\'d', 'skill issue']), '#ff3b30'); burst(P.x, P.y, '#ff3b30', 8); hud();
  if (P.hp <= 0) die();
}
let booms = [];

// ---------- update (the game rules: unchanged from the 2D version apart from mouse aim on the 3D board)
function update(dt) {
  if (fadeDir !== 0) { fade = clamp(fade + fadeDir * dt * 3, 0, 1); if (fadeDir > 0 && fade >= 1) { enterNextRoom(); fadeDir = -1; } if (fadeDir < 0 && fade <= 0) fadeDir = 0; return; }
  t += dt;

  let dx = 0, dy = 0;
  if (keys.w || keys.arrowup) dy -= 1; if (keys.s || keys.arrowdown) dy += 1; if (keys.a || keys.arrowleft) dx -= 1; if (keys.d || keys.arrowright) dx += 1;
  if (moveT) { const tx = moveT.x - moveT.ox, ty = moveT.y - moveT.oy, l = Math.hypot(tx, ty); if (l > 6) { const m = Math.min(1, l / 55); dx = tx / l * m; dy = ty / l * m; } }
  const ml = Math.hypot(dx, dy); if (ml > 1) { dx /= ml; dy /= ml; }
  P.moving = ml > 0.05;
  P.x += dx * 235 * dt; P.y += dy * 235 * dt;
  {
    const ex = room.unlocked ? room.exit : null; const inGap = ex && inDoorGap(ex, P.x, P.y);
    const minX = (inGap && ex === 'left') ? -P.r - 30 : WALL + P.r, maxX = (inGap && ex === 'right') ? W + P.r + 30 : W - WALL - P.r;
    const minY = (inGap && ex === 'top') ? -P.r - 30 : WALL + P.r, maxY = (inGap && ex === 'bottom') ? H + P.r + 30 : H - WALL - P.r;
    P.x = clamp(P.x, minX, maxX); P.y = clamp(P.y, minY, maxY);
    if (P.x < -P.r || P.x > W + P.r || P.y < -P.r || P.y > H + P.r) { nextRoom(); return; }
  }
  if (hurtT > 0) hurtT -= dt;

  let aim = null, nearest = null, nd = 1e9;
  for (const e of enemies) { const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < nd) { nd = d; nearest = e; } }
  if (aimT) { const tx = aimT.x - aimT.ox, ty = aimT.y - aimT.oy; if (Math.hypot(tx, ty) > 10) aim = Math.atan2(ty, tx); }
  if (aim === null && mouse.on && !moveT) { const m = mouseOnBoard(); if (m) aim = Math.atan2(m.y - P.y, m.x - P.x); }
  if (aim === null && nearest) aim = Math.atan2(nearest.y - P.y, nearest.x - P.x);
  if (aim !== null) P.dir = aim;

  const w = WEAPONS[P.weapon]; P.cd -= dt; if (P.swing > 0) P.swing -= dt; laserOn = false;
  const wantFire = aimT || mouse.on || nearest;
  if (wantFire && aim !== null) {
    if (w.beam) {
      laserOn = true; if (Math.random() < 0.25) sfx.laser();
      const ex = Math.cos(P.dir), ey = Math.sin(P.dir);
      for (const e of [...enemies]) { const rx = e.x - P.x, ry = e.y - P.y, proj = rx * ex + ry * ey; if (proj < 0) continue; const perp = Math.abs(rx * ey - ry * ex); if (perp < e.r + 4) { damageEnemy(e, 9 * dt, ex * 40 * dt, ey * 40 * dt); if (Math.random() < 0.3) burst(e.x, e.y, '#ff3b30', 1, 80); } }
      for (const c of [...crates]) { const rx = c.x - P.x, ry = c.y - P.y, proj = rx * ex + ry * ey; if (proj < 0) continue; if (Math.abs(rx * ey - ry * ex) < c.r + 4) hitCrate(c, 6 * dt); }
    } else if (w.melee) {
      if (P.cd <= 0 && nearest && nd < 90) {
        P.cd = w.cd; P.swing = 0.18; sfx.hammer(); shake = 3;
        for (const e of [...enemies]) { const ex = e.x - P.x, ey = e.y - P.y, d = Math.hypot(ex, ey); if (d > 78 + e.r) continue; let da = Math.atan2(ey, ex) - P.dir; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > 1.25) continue; damageEnemy(e, 5, ex / d * 60, ey / d * 60); }
        for (const c of [...crates]) { if (Math.hypot(c.x - P.x, c.y - P.y) < 78 + c.r) hitCrate(c, 3); }
      }
    } else if (P.cd <= 0) { P.cd = w.cd; w.fire(P.dir); }
  }

  spawnT -= dt; if (spawnT <= 0 && spawned < quota) { spawn(); spawned++; spawnT = Math.max(0.25, 1.2 - wave * 0.06); if (room.boss) spawnT += 0.5; }
  crateT -= dt; if (crateT <= 0 && crates.length < 3) { spawnCrate(); crateT = rnd(9, 14); }

  for (const e of [...enemies]) {
    const ex = P.x - e.x, ey = P.y - e.y, d = Math.hypot(ex, ey) || 1; e.wob += dt * 6; if (e.flash > 0) e.flash -= dt; if (e.slow > 0) e.slow -= dt;
    const sp = e.speed * (e.slow > 0 ? 0.4 : 1);
    if (e.ranged) {
      const want = 190; const dir = d > want + 20 ? 1 : d < want - 20 ? -1 : 0;
      e.x += ex / d * sp * dir * dt + Math.cos(e.wob) * 30 * dt; e.y += ey / d * sp * dir * dt + Math.sin(e.wob) * 30 * dt;
      e.shotT -= dt; if (e.shotT <= 0) { e.shotT = rnd(1.4, 2.4); const a = Math.atan2(ey, ex); ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, r: 5, life: 3, text: pick(adviceLines) }); }
    } else if (e.boss) {
      e.x += ex / d * sp * dt; e.y += ey / d * sp * dt;
      e.shotT -= dt; if (e.shotT <= 0) { e.shotT = 1.6; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + e.wob; ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 6, life: 3.5 }); } }
    } else {
      const wob = e.type === 'spammer' ? Math.sin(e.wob) * 0.6 : 0; const a = Math.atan2(ey, ex) + wob;
      e.x += Math.cos(a) * sp * dt; e.y += Math.sin(a) * sp * dt;
    }
    if (!e.inside && e.x > WALL + e.r && e.x < W - WALL - e.r && e.y > WALL + e.r && e.y < H - WALL - e.r) e.inside = true;
    if (e.inside) { e.x = clamp(e.x, WALL + e.r, W - WALL - e.r); e.y = clamp(e.y, WALL + e.r, H - WALL - e.r); }
    for (const o of enemies) { if (o === e) continue; const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = e.r + o.r; if (od > 0 && od < min) { e.x += ox / od * (min - od) * 0.5; e.y += oy / od * (min - od) * 0.5; } }
    if (d < P.r + e.r) { if (e.bomb) { damageEnemy(e, 99); } else { hurt(); if (e.type === 'troll') { const k = 40; P.x = clamp(P.x + ex / d * k, WALL + P.r, W - WALL - P.r); P.y = clamp(P.y + ey / d * k, WALL + P.r, H - WALL - P.r); } } if (!running) return; }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (b.x < WALL || b.x > W - WALL || b.y < WALL || b.y > H - WALL) { if (b.bounces > 0) { b.bounces--; if (b.x < WALL || b.x > W - WALL) b.vx *= -1; if (b.y < WALL || b.y > H - WALL) b.vy *= -1; b.x = clamp(b.x, WALL, W - WALL); b.y = clamp(b.y, WALL, H - WALL); b.hitSet.clear(); } else dead = true; }
    if (!dead) {
      for (const e of enemies) {
        if (b.hitSet.has(e)) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          if (b.splash) { explode(b.x, b.y, b.splash, b.dmg, false); dead = true; break; }
          const kx = b.vx * 0.03, ky = b.vy * 0.03; damageEnemy(e, b.dmg, kx, ky); sfx.hit(); burst(b.x, b.y, b.color, 3, 90);
          if (b.pierce) { b.hitSet.add(e); } else if (b.bounces > 0) { b.bounces--; b.vx *= -1; b.vy *= -1; b.hitSet.add(e); } else { dead = true; }
          break;
        }
      }
    }
    if (!dead) { for (const c of crates) { if (Math.hypot(c.x - b.x, c.y - b.y) < c.r + b.r) { if (b.splash) { explode(b.x, b.y, b.splash, b.dmg, false); } else hitCrate(c, b.dmg); dead = !b.pierce; break; } } }
    if (dead) bullets.splice(i, 1);
  }

  for (let i = ebullets.length - 1; i >= 0; i--) {
    const b = ebullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (Math.hypot(P.x - b.x, P.y - b.y) < P.r + b.r) { ebullets.splice(i, 1); hurt(); if (!running) return; continue; }
    if (b.life <= 0) ebullets.splice(i, 1);
  }

  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]; d.life -= dt;
    const dist = Math.hypot(P.x - d.x, P.y - d.y);
    if (d.kind === 'coin' && dist < 70) { d.x += (P.x - d.x) * 8 * dt; d.y += (P.y - d.y) * 8 * dt; }
    if (dist < P.r + d.r) {
      drops.splice(i, 1);
      if (d.kind === 'coin') { coins += 1; sfx.coin(); popText(d.x, d.y, '+1', '#ffd166'); }
      else if (d.kind === 'heart') { P.hp = Math.min(P.maxHp, P.hp + 1); sfx.heart(); popText(d.x, d.y, '+heart', '#ff3b30'); }
      else if (d.kind === 'key') { hasKey = true; room.unlocked = true; sfx.pickup(); banner('Door unlocked — loot up, then go'); popText(d.x, d.y, 'KEY', '#ffd166'); }
      else setWeapon(d.key);
      hud(); continue;
    }
    if (d.life <= 0) drops.splice(i, 1);
  }

  for (const c of crates) if (c.flash > 0) c.flash -= dt;
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.h = Math.max(1, p.h + p.vh * dt); p.vh -= 520 * dt; p.life -= dt; if (p.life <= 0) parts.splice(i, 1); }
  for (let i = texts.length - 1; i >= 0; i--) { const x = texts[i]; x.h += 30 * dt; x.life -= dt; if (x.life <= 0) texts.splice(i, 1); }
  for (let i = booms.length - 1; i >= 0; i--) { booms[i].life -= dt; if (booms[i].life <= 0) booms.splice(i, 1); }
  if (shake > 0) shake = Math.max(0, shake - dt * 30);
  if (Math.floor(t) !== Math.floor(t - dt)) hud();
}

// ---------- 3D drawing: keep one 3D object per thing in the game, add/remove them as things appear/go
const live = { enemies: new Map(), crates: new Map(), drops: new Map(), bullets: new Map(), ebullets: new Map(), parts: new Map(), booms: new Map() };
function sync(map, list, create, update) {
  const seen = new Set();
  for (const it of list) { let o = map.get(it); if (!o) { o = create(it); map.set(it, o); scene.add(o); } update(it, o); seen.add(it); }
  for (const [it, o] of map) if (!seen.has(it)) { scene.remove(o); disposeInstance(o); map.delete(it); }
}
function clearAll() { for (const m of Object.values(live)) sync(m, [], null, null); }

let player = null, gunObj = null, hammerObj = null, tipMats = [];
const laserGroup = new THREE.Group(), swingMesh = new THREE.Mesh(new THREE.RingGeometry(56, 74, 32, 1, -1.15, 2.3), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
{
  const outer = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: '#ff3b30' })); outer.scale.set(1, 10, 10);
  const core = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: '#ffffff' })); core.scale.set(1.001, 0.45, 0.45); outer.add(core);
  laserGroup.add(outer); laserGroup.userData.beam = outer; laserGroup.visible = false; scene.add(laserGroup);
  swingMesh.rotation.x = -Math.PI / 2; const sg = new THREE.Group(); sg.add(swingMesh); sg.position.y = 12; scene.add(sg); swingMesh.userData.group = sg;
}
function makePlayer() {
  if (player) { scene.remove(player); disposeInstance(player); }
  player = instance('aleks'); player.scale.setScalar(14 * VIS);
  gunObj = player.getObjectByName('Gun'); hammerObj = player.getObjectByName('Hammer');
  tipMats = matsNamed(player, 'WeaponTip'); scene.add(player);
}

function drawScene(dt) {
  const T = performance.now() / 1000;
  // player
  const moving = P.moving;
  const bob = moving ? Math.abs(Math.sin(t * 14)) * 3 : Math.sin(t * 3) * 1;
  player.position.set(wx(P.x), bob, wz(P.y));
  player.rotation.y = faceAngle(P.dir);
  player.rotation.z = moving ? Math.sin(t * 14) * 0.06 : 0;
  player.visible = !(hurtT > 0 && Math.floor(hurtT * 20) % 2 === 0);
  const w = WEAPONS[P.weapon];
  gunObj.visible = !w.melee; hammerObj.visible = !!w.melee;
  for (const m of tipMats) { m.color.set(w.color); m.emissive.set(w.color); m.emissiveIntensity = 0.9; }
  if (w.melee) hammerObj.rotation.x = P.swing > 0 ? -1.2 * (P.swing / 0.18) : 0;
  // hammer swing arc + laser
  const k = Math.max(0, P.swing / 0.18);
  swingMesh.material.opacity = k * 0.85; swingMesh.userData.group.position.set(wx(P.x), 14, wz(P.y)); swingMesh.userData.group.rotation.y = -P.dir;
  laserGroup.visible = laserOn;
  if (laserOn) { const L = Math.max(W, H) * 1.5; const beam = laserGroup.userData.beam; beam.scale.x = L; beam.position.set(16 + L / 2, 0, 0); laserGroup.position.set(wx(P.x), 21, wz(P.y)); laserGroup.rotation.y = -P.dir; beam.children[0].scale.y = 0.35 + Math.random() * 0.2; }

  sync(live.enemies, enemies, (e) => { const o = instance(MODEL_FOR[e.type]); o.userData.spark = matsNamed(o, 'Spark'); return o; }, (e, o) => {
    const b = Math.sin(e.wob * 1.5) * 2, sq = 1 + Math.sin(e.wob * 3) * 0.05;
    o.position.set(wx(e.x), b, wz(e.y)); o.scale.set(e.r * VIS, e.r * VIS * sq, e.r * VIS);
    o.rotation.y = faceAngle(Math.atan2(P.y - e.y, P.x - e.x));
    o.rotation.z = e.type === 'spammer' ? Math.sin(e.wob) * 0.2 : 0;
    setFlash(o, e.flash > 0);
    for (const m of o.userData.spark) m.emissiveIntensity = Math.floor(e.wob * 8) % 2 === 0 ? 4 : 1.2;
  });
  sync(live.crates, crates, () => instance('crate'), (c, o) => { o.position.set(wx(c.x), 0, wz(c.y)); o.scale.setScalar(c.r * 1.25); setFlash(o, c.flash > 0); });
  sync(live.drops, drops, (d) => {
    const o = instance(d.kind === 'weapon' ? 'weaponbox' : d.kind);
    if (d.kind === 'weapon') for (const m of matsNamed(o, 'Accent')) { m.color.set(WEAPONS[d.key].color); m.emissive.set(WEAPONS[d.key].color); m.emissiveIntensity = 0.7; m.userData.baseEmissive.copy(m.emissive); m.userData.baseIntensity = 0.7; }
    if (d.kind === 'key') for (const m of o.userData.mats) { m.emissive.set('#ffb000'); m.userData.baseEmissive.copy(m.emissive); }
    return o;
  }, (d, o) => {
    const blink = d.life < 3 && Math.floor(d.life * 6) % 2 === 0;
    o.visible = !blink;
    const hover = Math.sin(t * 5 + d.x) * 3;
    const s = d.kind === 'coin' ? 7 : d.kind === 'heart' ? 10 : d.kind === 'key' ? 11 : 12;
    o.scale.setScalar(s * 1.4);
    o.position.set(wx(d.x), (d.kind === 'weapon' ? 2 : 6) + hover, wz(d.y));
    o.rotation.y = d.kind === 'weapon' ? 0.3 + Math.sin(T) * 0.25 : T * (d.kind === 'coin' ? 3 : 1.6) + d.x;
    if (d.kind === 'key') for (const m of o.userData.mats) m.emissiveIntensity = 0.35 + Math.sin(T * 6) * 0.25;
  });
  sync(live.bullets, bullets, (b) => { const m = new THREE.Mesh(SPHERE, basicMat(b.color)); m.scale.setScalar(b.r * 1.25 + 1); return m; }, (b, o) => { o.position.set(wx(b.x), 21, wz(b.y)); });
  sync(live.ebullets, ebullets, (b) => { const m = new THREE.Mesh(SPHERE, basicMat('#e8f4ff')); m.scale.setScalar(b.r + 3); const s = new THREE.Mesh(SPHERE, OUTLINE_MAT); s.scale.setScalar(1.25); m.add(s); return m; }, (b, o) => { o.position.set(wx(b.x), 16, wz(b.y)); });
  sync(live.parts, parts, (p) => new THREE.Mesh(SPHERE, basicMat(p.color)), (p, o) => { o.position.set(wx(p.x), p.h, wz(p.y)); o.scale.setScalar(p.r * Math.max(0.15, Math.min(1, p.life / 0.4))); });
  sync(live.booms, booms, () => new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({ color: '#ff8a5a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })), (b, o) => { const k2 = 1 - b.life / 0.35; o.position.set(wx(b.x), 8, wz(b.y)); o.scale.set(b.rad * (0.4 + k2 * 0.7), b.rad * 0.35 * (1 - k2 * 0.5), b.rad * (0.4 + k2 * 0.7)); o.material.opacity = 0.55 * (1 - k2); });

  // doors
  for (const [name, dp] of Object.entries(doorParts)) {
    const isExit = name === room.exit, open = isExit && room.unlocked, glow = isExit && room.cleared;
    dp.panel.visible = !open;
    dp.pm.emissiveIntensity = glow && !open ? 0.25 + Math.sin(t * 5) * 0.2 : 0;
    dp.gm.opacity = open ? 0.45 + Math.sin(t * 6) * 0.25 : 0;
    dp.light.intensity = open ? 4 + Math.sin(t * 6) * 1.5 : glow ? 1.5 : 0;
  }

  // danger tint + camera shake
  $('danger').style.opacity = (0.22 + Math.min(1, enemies.length / 25) * 0.6).toFixed(3);
  camera.position.copy(camBase);
  if (shake > 0) camera.position.add(new THREE.Vector3(rnd(-shake, shake), rnd(-shake, shake) * 0.5, rnd(-shake, shake)).multiplyScalar(1.2));
  renderer.render(scene, camera);
}

// ---------- 2D layer on top: names, floating text, labels, touch sticks, room fade
const pv = new THREE.Vector3();
function toScreen(x, h, y) { pv.set(wx(x), h, wz(y)).project(camera); return { x: (pv.x + 1) / 2 * VW, y: (1 - pv.y) / 2 * VH, on: pv.z < 1 }; }
function label(text, x, y, color = 'rgba(255,255,255,.8)', size = 10, weight = 700) {
  fctx.font = `${weight} ${size}px "Inter Tight", sans-serif`; fctx.textAlign = 'center'; fctx.lineWidth = 3; fctx.strokeStyle = 'rgba(0,0,0,.75)'; fctx.strokeText(text, x, y); fctx.fillStyle = color; fctx.fillText(text, x, y);
}
function drawOverlay() {
  fctx.setTransform(DPR, 0, 0, DPR, 0, 0); fctx.clearRect(0, 0, VW, VH);
  const s = Math.min(1.25, Math.max(0.8, VW / 1100));
  for (const e of enemies) {
    const p = toScreen(e.x, e.r * VIS * (e.boss ? 2.8 : 2.4) + 6, e.y);
    label(e.name, p.x, p.y, e.boss ? '#ff3b30' : 'rgba(255,255,255,.85)', (e.boss ? 13 : 10) * s);
    if (e.boss || e.type === 'troll') { const bw = e.r * 2.2 * s; fctx.fillStyle = OUT; fctx.fillRect(p.x - bw / 2 - 1, p.y + 4, bw + 2, 7); fctx.fillStyle = e.boss ? '#ff3b30' : e.color; fctx.fillRect(p.x - bw / 2, p.y + 5, bw * Math.max(0, e.hp / e.maxHp), 5); }
  }
  for (const c of crates) { const p = toScreen(c.x, c.r * 2.5 + 10, c.y); label('CLIP', p.x, p.y, '#ffd166', 9 * s); }
  for (const d of drops) {
    if (d.kind === 'key') { const p = toScreen(d.x, 40, d.y); label('KEY', p.x, p.y, '#ffd166', 10 * s); }
    else if (d.kind === 'weapon' && !(d.life < 3 && Math.floor(d.life * 6) % 2 === 0)) { const p = toScreen(d.x, 34, d.y); label(WEAPONS[d.key].name, p.x, p.y, WEAPONS[d.key].color, 10 * s); }
  }
  for (const b of ebullets) if (b.text) { const p = toScreen(b.x, 34, b.y); label(b.text, p.x, p.y, '#3fb5ff', 9 * s); }
  if (room) for (const name of room.doors) {
    if (name !== room.exit || !room.cleared) continue;
    const d = doorPos(name); const p = toScreen(d.x, WALLH + 12, d.y);
    label(room.unlocked ? 'EXIT' : 'LOCKED', p.x, p.y, '#ffd166', 11 * s);
  }
  { const p = toScreen(P.x, 14 * VIS * 2.6 + 6, P.y); label('AleksK9', p.x, p.y, '#ff3b30', 11 * s); }
  for (const x of texts) { const p = toScreen(x.x, x.h, x.y); fctx.globalAlpha = Math.min(1, x.life * 1.5); label(x.text, p.x, p.y, x.color, 13 * s, 800); }
  fctx.globalAlpha = 1;
  for (const st of [moveT, aimT]) {
    if (!st) continue;
    fctx.strokeStyle = 'rgba(255,255,255,.18)'; fctx.lineWidth = 3; fctx.beginPath(); fctx.arc(st.ox, st.oy, 55, 0, TAU); fctx.stroke();
    const tx = st.x - st.ox, ty = st.y - st.oy, l = Math.hypot(tx, ty), m = Math.min(55, l);
    fctx.fillStyle = st === aimT ? 'rgba(255,59,48,.5)' : 'rgba(255,255,255,.4)'; fctx.strokeStyle = OUT; fctx.beginPath(); fctx.arc(st.ox + (l ? tx / l * m : 0), st.oy + (l ? ty / l * m : 0), 18, 0, TAU); fctx.fill(); fctx.stroke();
  }
  if (fade > 0) { fctx.fillStyle = `rgba(5,5,5,${fade})`; fctx.fillRect(0, 0, VW, VH); }
}

function frame(dt) { drawScene(dt); drawOverlay(); }
function loop(now) {
  if (!running) return;
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  update(dt);
  if (running) { frame(dt); requestAnimationFrame(loop); }
}

// ---------- end of a run + leaderboard
let board = [], online = false, me = null, lastId = null;
function loadLocal() { try { return JSON.parse(localStorage.getItem('chatSurvivorsBoard') || '[]'); } catch { return []; } }
function saveLocal(b) { try { localStorage.setItem('chatSurvivorsBoard', JSON.stringify(b.slice(0, 20))); } catch { /* private mode */ } }
async function fetchBoard() {
  try {
    const r = await fetch('/api/game-scores', { cache: 'no-store' }); const d = await r.json();
    online = !d.offline; board = online ? d.scores : loadLocal();
  } catch { online = false; board = loadLocal(); }
  renderBoard();
}
function renderBoard() {
  const b = $('board'); b.innerHTML = '';
  if (!board.length) { b.innerHTML = '<li class="empty">Nobody has survived yet.</li>'; return; }
  board.slice(0, online ? 10 : 5).forEach((e, i) => {
    const li = document.createElement('li'); if (e.id && e.id === lastId) li.className = 'you';
    const n = document.createElement('span'); n.className = 'n'; n.textContent = i + 1;
    const nm = document.createElement('span'); nm.textContent = e.name;
    const sc = document.createElement('span'); sc.textContent = `${e.rooms} room${e.rooms === 1 ? "" : "s"} · ${fmt(e.t)}`;
    li.append(n, nm, sc); b.appendChild(li);
  });
}
function die() {
  running = false; sfx.dead(); if (navigator.vibrate) navigator.vibrate([100, 50, 200]); frame(0);
  $('finalTime').textContent = fmt(t);
  $('kills').textContent = kills; $('finalWave').textContent = wave; $('finalCoins').textContent = coins; $('finalWeapons').textContent = weaponsUsed.size;
  $('overMsg').textContent = wave <= 2 ? 'Chat ate you alive.' : wave <= 5 ? 'Held on for a bit. Chat wins this one.' : wave <= 10 ? 'Respectable. Mods would be proud.' : 'That was a legendary stream.';
  $('submit').disabled = false; $('submit').textContent = 'Submit'; $('note').textContent = me ? `Saved under your Twitch name, ${me.name || me.login}.` : '';
  if (me) { $('name').value = me.name || me.login; $('name').disabled = true; } else { $('name').disabled = false; }
  lastId = null; fetchBoard(); $('over').classList.remove('hidden');
}
$('submit').onclick = async () => {
  const name = ($('name').value.trim() || 'anon').replace(/[<>]/g, '').slice(0, 16);
  $('submit').disabled = true; $('submit').textContent = 'Saving…';
  const run = { name, rooms: wave, t: Math.floor(t), kills };
  if (online) {
    try {
      const r = await fetch('/api/game-scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) });
      const d = await r.json();
      if (!r.ok) { $('note').textContent = d.error || 'Could not save. Try again.'; $('submit').disabled = false; $('submit').textContent = 'Submit'; return; }
      lastId = d.entry.id; $('note').textContent = d.rank ? `You're #${d.rank} on the board.` : 'Saved.';
      $('submit').textContent = 'Submitted'; await fetchBoard(); return;
    } catch { online = false; }
  }
  const entry = { ...run, id: 'l' + Date.now() }; lastId = entry.id;
  board = [...loadLocal(), entry].sort((a, b) => b.rooms - a.rooms || b.t - a.t); saveLocal(board); renderBoard();
  $('submit').textContent = 'Submitted'; $('note').textContent = 'Saved on this device.';
};
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !$('submit').disabled) $('submit').click(); });

function start() {
  audio(); $('start').classList.add('hidden'); $('over').classList.add('hidden');
  clearAll(); reset(); makePlayer(); running = true; last = performance.now(); requestAnimationFrame(loop);
}
$('play').onclick = start; $('again').onclick = start;
/* For testing: /game?debug exposes a few controls in the browser console. */
if (new URLSearchParams(location.search).has('debug')) window.cs = { weapon: (k) => setWeapon(k), spawn: (k, n = 1) => { for (let i = 0; i < n; i++) spawn(k); }, state: () => ({ wave, kills, hp: P.hp, enemies: enemies.length, room }), heal: () => { P.hp = P.maxHp; hud(); }, room: (n) => { wave = n - 1; room.exit = room.doors[0]; enterNextRoom(); } };

// ---------- boot: load the models, show the first room behind the start card
resize();
fetch('/api/me', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((d) => { me = d && d.user ? d.user : null; }).catch(() => {});
loadModels((p) => { $('play').textContent = `Loading 3D… ${Math.round(p * 100)}%`; })
  .then(() => {
    reset(); makePlayer(); frame(0);
    $('play').disabled = false; $('play').textContent = 'Start stream';
    addEventListener('resize', () => { if (!running && room) frame(0); });
  })
  .catch((err) => { console.error(err); $('play').textContent = 'Could not load the 3D models. Refresh to try again.'; });
