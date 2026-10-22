// Mapa 3D del circuito Dragon Rush (Three.js).
// Campus low-poly construido a partir del plano ilustrado (img/plano-circuito.jpg).
// Coordenadas: se usan las del plano en píxeles (1024x765) y se convierten con P().
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const STATIONS = [
  { id: '1', name: 'Fútbol', desc: 'Reto de precisión con balón.', where: 'Canchas de fútbol', px: [895, 375] },
  { id: '2', name: 'Puntería', desc: 'Lanzamientos a zonas de puntaje.', where: 'Canchas de tenis', px: [795, 432] },
  { id: '3', name: 'Vóley', desc: 'Reto de control y continuidad.', where: 'Canchas de arena', px: [688, 382] },
  { id: '4', name: 'Resistencia', desc: 'Reto de fuerza y aguante.', where: 'Cuadrángulos', px: [400, 400] },
];

const C = {
  ground: 0xcfe0b8, grass: 0x86b96b, park: 0x6fa95a, field: 0x4fa84a, sand: 0xe8d29c,
  court: 0x9aa3a8, plaza: 0xe9e0cc, path: 0xd9d4c7, water: 0x6fb3d6,
  wall: 0xe7b8a0, wallDark: 0xc98e74, brick: 0xa4553d, roof: 0xb5543c, roofGreen: 0x3e8e6e,
  roofGray: 0x8c9399, glass: 0x5b7fa6, glassLight: 0x86a9cc, gold: 0xd4a72c, stone: 0xd9c7a8,
  tree: 0x3f7f3a, treeLight: 0x5f9e45, trunk: 0x7a5236, white: 0xffffff, navy: 0x2e3f73,
  red: 0xed1c24, black: 0x101010,
};

const P = (px, py) => new THREE.Vector3((px - 512) / 10, 0, (py - 400) / 10);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;

export function initMapa3D(root, { onSelect } = {}) {
  const canvasWrap = root.querySelector('.m3d-canvas');
  const labelsEl = root.querySelector('.m3d-labels');
  const info = root.querySelector('.m3d-info');

  // ---------- renderer / escena ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    root.classList.add('m3d-fallback');
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  canvasWrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeeeeed);
  scene.fog = new THREE.Fog(0xeeeeed, 140, 260);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
  // vista general: en pantallas angostas se centra más en el circuito
  const narrow = canvasWrap.clientWidth < 520;
  const HOME = narrow
    ? { pos: new THREE.Vector3(58, 64, 70), target: new THREE.Vector3(16, 0, 2) }
    : { pos: new THREE.Vector3(46, 52, 64), target: new THREE.Vector3(8, 0, 0) };
  camera.position.copy(HOME.pos);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb38a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-50, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 60, bottom: -60, near: 10, far: 220 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // ---------- helpers ----------
  const matCache = new Map();
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra }));
    return matCache.get(key);
  };
  const add = (mesh, { cast = true, receive = true } = {}) => { mesh.castShadow = cast; mesh.receiveShadow = receive; scene.add(mesh); return mesh; };

  // zona plana (suelo de color) en coordenadas del plano
  const flat = (x1, y1, x2, y2, color, h = 0.08, tex) => {
    const a = P(x1, y1), b = P(x2, y2);
    const w = b.x - a.x, d = b.z - a.z;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }) : mat(color));
    m.position.set(a.x + w / 2, h / 2, a.z + d / 2);
    return add(m, { cast: false });
  };

  // edificio: bloque + techo a cuatro aguas
  const building = (cx, cy, wpx, dpx, h, wall, roof, roofH = 2.4, rot = 0) => {
    const g = new THREE.Group();
    const w = wpx / 10, d = dpx / 10;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(wall));
    body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
    // franja de ventanas
    const win = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h * 0.18, d + 0.05), mat(C.wallDark));
    win.position.y = h * 0.62; g.add(win);
    if (roof != null) {
      const r = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1), mat(roof));
      r.rotation.y = Math.PI / 4; r.scale.set(w * 1.06, roofH, d * 1.06);
      r.position.y = h + roofH / 2; r.castShadow = true; g.add(r);
    }
    const p = P(cx, cy); g.position.set(p.x, 0, p.z); g.rotation.y = rot;
    scene.add(g); return g;
  };

  const tree = (px, py, s = 1) => {
    const p = P(px, py);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.25 * s, 1.4 * s, 5), mat(C.trunk));
    t.position.set(p.x, 0.7 * s, p.z); add(t);
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25 * s, 0), mat(Math.random() > 0.5 ? C.tree : C.treeLight));
    c.position.set(p.x, 2.2 * s, p.z); c.rotation.y = Math.random() * 3; add(c);
  };

  const canvasTex = (w, h, draw) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };

  // ---------- terreno ----------
  const base = new THREE.Mesh(new THREE.BoxGeometry(112, 2, 86), mat(C.ground));
  base.position.set(0, -1, -1); add(base, { cast: false });
  // calles perimetrales
  flat(-10, -30, 1034, 0, C.path, 0.06);
  flat(-10, 770, 1034, 800, C.path, 0.06);

  // plaza de resistencia / auspiciantes
  flat(250, 290, 560, 520, C.plaza, 0.12);
  // parque
  flat(470, 190, 700, 345, C.park, 0.1);
  const pond = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.14, 20), mat(C.water, { roughness: 0.2, flatShading: false }));
  pond.position.copy(P(610, 265)).setY(0.12); add(pond, { cast: false });
  // zona verde del circuito
  flat(580, 330, 880, 515, C.grass, 0.1);

  // cancha de fútbol (textura con líneas)
  const fieldTex = canvasTex(512, 440, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#4fa84a' : '#5ab554'; g.fillRect(0, (h / 8) * i, w, h / 8); }
    g.strokeStyle = '#fff'; g.lineWidth = 5;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.beginPath(); g.moveTo(14, h / 2); g.lineTo(w - 14, h / 2); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 50, 0, Math.PI * 2); g.stroke();
    g.strokeRect(w / 2 - 110, 14, 220, 70); g.strokeRect(w / 2 - 110, h - 84, 220, 70);
  });
  flat(790, 280, 1000, 470, C.field, 0.14, fieldTex);
  // arcos
  [[895, 286], [895, 464]].forEach(([x, y]) => {
    const p = P(x, y);
    const goal = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: C.white, wireframe: true }));
    goal.position.set(p.x, 0.75, p.z); scene.add(goal);
  });

  // vóley (arena + red)
  const sandTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#e8d29c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(20, 16, w - 40, h - 32);
  });
  flat(620, 350, 760, 415, C.sand, 0.16, sandTex);
  const net = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 6), new THREE.MeshStandardMaterial({ color: C.white, wireframe: true }));
  net.position.copy(P(690, 382)).setY(1.4); scene.add(net);
  [-3, 3].forEach(dz => { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6), mat(C.black)); post.position.copy(P(690, 382)).add(new THREE.Vector3(0, 1.1, dz)); add(post); });

  // puntería (cancha gris + dianas)
  const courtTex = canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#8f9aa0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
    g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2, h - 14); g.stroke();
  });
  flat(745, 400, 855, 470, C.court, 0.16, courtTex);
  const targetTex = canvasTex(128, 128, (g) => {
    ['#ed1c24', '#fff', '#ed1c24', '#fff', '#ed1c24'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(64, 64, 62 - i * 12, 0, Math.PI * 2); g.fill(); });
  });
  [770, 795, 820].forEach(x => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.15, 24), [mat(C.white), new THREE.MeshStandardMaterial({ map: targetTex }), mat(C.white)]);
    t.rotation.x = Math.PI / 2; t.position.copy(P(x, 410)).setY(1.4); add(t);
  });

  // ---------- edificios (según el plano) ----------
  building(288, 125, 145, 90, 7, C.wall, C.roof, 2.6);
  building(450, 110, 160, 90, 8, C.wall, C.roofGreen, 2.2);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 2.4, 16), mat(C.stone));
  drum.position.copy(P(450, 85)).setY(11.2); add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.gold, { metalness: 0.5, roughness: 0.35 }));
  dome.position.copy(P(450, 85)).setY(12.4); add(dome);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 6), mat(C.gold, { metalness: 0.5, roughness: 0.35 }));
  spire.position.copy(P(450, 85)).setY(15.8); add(spire);
  building(560, 75, 120, 60, 7, C.wall, C.roofGreen, 1.8);
  building(430, 225, 180, 110, 9, C.wall, C.roof, 3);
  building(565, 175, 110, 90, 8, C.wall, C.roofGray, 2);
  building(200, 245, 190, 95, 6, C.wallDark, C.brick, 2.4);
  building(150, 335, 120, 70, 5, C.wall, C.brick, 2);
  building(240, 365, 90, 55, 4, C.wall, C.brick, 1.6);
  building(625, 110, 70, 60, 5, C.wall, C.roofGreen, 2.2);
  // torre del reloj
  building(65, 250, 50, 50, 15, C.stone, C.roofGray, 4);
  // pabellón de techo verde y obelisco
  building(775, 280, 140, 85, 4, C.stone, C.roofGreen, 6);
  const obel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 11, 1.6), mat(C.stone));
  obel.position.copy(P(737, 335)).setY(5.5); add(obel);
  const obelTop = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.6, 4), mat(C.stone));
  obelTop.position.copy(P(737, 335)).setY(11.8); obelTop.rotation.y = Math.PI / 4; add(obelTop);
  // torres de vidrio
  building(548, 505, 70, 75, 20, C.glass, null);
  building(595, 470, 50, 60, 24, C.glassLight, null);
  // edificios de ladrillo al sur
  building(725, 565, 160, 105, 6, C.brick, C.roof, 2.6, 0.12);
  building(610, 660, 120, 85, 5, C.brick, C.roof, 2.2);
  building(800, 650, 70, 60, 5, C.brick, C.roof, 2);
  building(650, 455, 70, 55, 4, C.wallDark, C.roof, 1.8);

  // carpas de auspiciantes y arcos inflables en la plaza
  const tent = (px, py, color) => {
    const p = P(px, py);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.4, 4), mat(color));
    roof.rotation.y = Math.PI / 4; roof.position.set(p.x, 3, p.z); add(roof);
    [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(([dx, dz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 4), mat(C.roofGray));
      leg.position.set(p.x + dx, 1.15, p.z + dz); scene.add(leg);
    });
  };
  [[405, 345, C.navy], [440, 350, C.white], [470, 385, C.white], [330, 425, C.navy], [370, 432, C.white], [445, 470, C.white]].forEach(t => tent(...t));
  const arch = (px, py, color, rot) => {
    const a = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.45, 8, 20, Math.PI), mat(color));
    a.position.copy(P(px, py)).setY(0.1); a.rotation.y = rot; add(a);
  };
  arch(355, 352, 0x2f5fd0, 0.6);
  arch(478, 462, C.red, -0.4);

  // árboles
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let x = 640; x <= 1010; x += 26) tree(x + rnd(-6, 6), 235 + rnd(-10, 10), rnd(0.9, 1.2));
  for (let y = 260; y <= 560; y += 28) tree(1010 + rnd(-5, 5), y, rnd(0.9, 1.2));
  for (let i = 0; i < 14; i++) tree(rnd(480, 690), rnd(200, 335), rnd(0.8, 1.15));
  for (let x = 260; x <= 540; x += 32) tree(x, 528 + rnd(-4, 4), 0.9);
  for (let i = 0; i < 10; i++) tree(rnd(560, 700), rnd(560, 740), rnd(0.8, 1.1));
  for (let y = 300; y <= 500; y += 30) tree(250, y, 0.85);

  // ---------- recorrido (línea roja) ----------
  const routePts = [[598, 345], [700, 332], [770, 330], [868, 388], [882, 440], [835, 505], [700, 508], [604, 472], [588, 400]]
    .map(([x, y]) => P(x, y).setY(0.4));
  const curve = new THREE.CatmullRomCurve3(routePts, true, 'catmullrom', 0.4);
  add(new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.38, 8, true), mat(C.red, { flatShading: false, emissive: 0x5a0306 })), { cast: false });

  // ---------- estaciones: marcadores 3D ----------
  const pinGroups = STATIONS.map(st => {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), mat(C.black));
    stem.position.y = 2.5; g.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), mat(C.red, { flatShading: false, emissive: 0x3a0002 }));
    head.position.y = 5.8; head.castShadow = true; g.add(head);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 32), mat(C.red, { flatShading: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    g.position.copy(P(...st.px)); g.userData = { st, head, ring };
    scene.add(g); return g;
  });

  // etiquetas HTML (botones accesibles) que siguen a cada marcador
  const labels = STATIONS.map((st, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'm3d-pin'; b.dataset.pin = st.id;
    b.innerHTML = `<b>${st.id}</b><span>${st.name}</span>`;
    b.setAttribute('aria-label', `Estación ${st.id}: ${st.name}. Ver en el mapa`);
    b.addEventListener('click', () => select(st.id));
    labelsEl.appendChild(b);
    return { el: b, group: pinGroups[i] };
  });

  // ---------- controles ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.target);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 22; controls.maxDistance = 170;
  controls.maxPolarAngle = Math.PI * 0.44; controls.minPolarAngle = 0.15;
  controls.screenSpacePanning = false;
  controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 0.55;
  controls.enableZoom = false; // se activa al interactuar, para no secuestrar el scroll de la página
  controls.update();

  const stopAuto = () => { controls.autoRotate = false; };
  controls.addEventListener('start', stopAuto);

  // en táctil: un toque "activa" el mapa; mientras tanto el dedo hace scroll normal
  const activate = () => { root.classList.add('m3d-active'); controls.enabled = true; controls.enableZoom = true; };
  if (coarse) {
    controls.enabled = false;
    root.querySelector('.m3d-activate')?.addEventListener('click', activate);
  } else {
    renderer.domElement.addEventListener('pointerdown', () => { controls.enableZoom = true; });
    renderer.domElement.addEventListener('pointerleave', () => { controls.enableZoom = false; });
  }

  // limitar el paneo al campus
  const clampTarget = () => {
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -50, 50);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -40, 36);
    controls.target.y = 0;
  };

  // ---------- animación de cámara ----------
  let fly = null;
  const ease = t => 1 - Math.pow(1 - t, 3);
  function flyTo(pos, target, ms = 1200) {
    if (reduceMotion) { camera.position.copy(pos); controls.target.copy(target); controls.update(); return; }
    fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), ms };
  }

  let active = null;
  function select(id) {
    stopAuto();
    if (coarse) activate();
    active = id;
    const g = pinGroups.find(p => p.userData.st.id === id);
    const st = g.userData.st;
    const target = g.position.clone();
    const dir = camera.position.clone().sub(controls.target).setY(0).normalize();
    const pos = target.clone().add(dir.multiplyScalar(26)).setY(24);
    flyTo(pos, target);
    labels.forEach(l => l.el.classList.toggle('active', l.el.dataset.pin === id));
    info.hidden = false;
    info.querySelector('.m3d-num').textContent = st.id;
    info.querySelector('.m3d-name').textContent = st.name;
    info.querySelector('.m3d-desc').textContent = st.desc;
    info.querySelector('.m3d-where').textContent = st.where;
    onSelect?.(id);
  }
  function reset() {
    active = null; info.hidden = true;
    labels.forEach(l => l.el.classList.remove('active'));
    flyTo(HOME.pos.clone(), HOME.target.clone());
    onSelect?.(null);
  }
  function highlight(id) {
    labels.forEach(l => l.el.classList.toggle('hover', l.el.dataset.pin === id));
  }
  function zoom(f) {
    stopAuto();
    const off = camera.position.clone().sub(controls.target).multiplyScalar(f);
    const len = THREE.MathUtils.clamp(off.length(), controls.minDistance, controls.maxDistance);
    flyTo(controls.target.clone().add(off.setLength(len)), controls.target.clone(), 450);
  }
  info.querySelector('.m3d-close').addEventListener('click', reset);
  root.querySelector('[data-m3d="reset"]').addEventListener('click', reset);
  root.querySelector('[data-m3d="in"]').addEventListener('click', () => zoom(0.75));
  root.querySelector('[data-m3d="out"]').addEventListener('click', () => zoom(1.3));

  // ---------- tamaño ----------
  const resize = () => {
    const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // más lejos en pantallas angostas para que entre todo el campus
    camera.fov = w < 520 ? 52 : 40;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvasWrap);
  resize();

  // ---------- loop (solo cuando está visible) ----------
  let visible = false, raf = 0;
  const v = new THREE.Vector3();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (fly) {
      const t = Math.min(1, (now - fly.start) / fly.ms), k = ease(t);
      camera.position.lerpVectors(fly.p0, fly.p1, k);
      controls.target.lerpVectors(fly.t0, fly.t1, k);
      if (t === 1) fly = null;
    }
    controls.update(); clampTarget();
    // marcadores: flotan suavemente; el activo crece
    const time = now / 1000;
    pinGroups.forEach((g, i) => {
      const on = g.userData.st.id === active;
      const s = THREE.MathUtils.lerp(g.scale.x, on ? 1.35 : 1, 0.15);
      g.scale.setScalar(s);
      g.userData.head.position.y = 5.8 + (reduceMotion ? 0 : Math.sin(time * 2 + i) * 0.25);
      g.userData.ring.scale.setScalar(1 + (reduceMotion ? 0 : (time * 0.8 + i * 0.25) % 1 * 0.6));
    });
    renderer.render(scene, camera);
    // posicionar etiquetas HTML
    const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
    labels.forEach(({ el, group }) => {
      v.copy(group.position).setY(7.6 * group.scale.y).project(camera);
      const hidden = v.z > 1;
      el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
      el.style.visibility = hidden ? 'hidden' : 'visible';
    });
  }
  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(root);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  root.classList.add('m3d-ready');
  return { select, reset, highlight };
}
