// Mapa 3D del circuito Dragon Rush (Three.js).
// Campus USFQ en estilo low-poly, armado a partir de las tomas aéreas del recorrido virtual:
//   oeste: césped con el Hall Principal y sus gradas, Espejo; centro: Galileo y el lago; este: Pagoda,
//   torre, cancha sintética y tenis; franja sur: camino de palmeras, cuadrángulos, vóley playa y césped grande.
// Coordenadas en unidades de mundo (x = este, z = sur). Distancias aproximadas.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// view = desde dónde mira la cámara al ir a esa estación (offset respecto al punto)
const STATIONS = [
  { id: '1', name: 'Fútbol', desc: 'Reto de precisión con balón.', where: 'Cancha de fútbol', at: [86, -22], view: [22, 30, 38] },
  { id: '2', name: 'Puntería', desc: 'Lanzamientos a zonas de puntaje.', where: 'Canchas de tenis', at: [108, 9], view: [8, 32, 40] },
  { id: '3', name: 'Vóley', desc: 'Reto de control y continuidad.', where: 'Cancha de vóley playa', at: [54, 44], view: [-12, 28, 34] },
  { id: '4', name: 'Resistencia', desc: 'Reto de fuerza y aguante.', where: 'Cuadrángulos', at: [-33, 33], view: [24, 30, 36] },
  { id: 'meta', name: 'Meta', desc: 'Suben las gradas y cruzan juntos.', where: 'Gradas del Hall Principal', at: [-55, 33], view: [40, 30, 22], flag: true },
];

const TAGS = [
  { name: 'Hall Principal', at: [-71, 10, 24] },
  { name: 'Espejo', at: [-63, 12, -39] },
  { name: 'Galileo', at: [0, 8.5, -6] },
  { name: 'Einstein', at: [-4, 15.5, -48] },
  { name: 'Casa Blanca', at: [23, 9, -47] },
  { name: 'Lago', at: [31, 1.5, 14] },
  { name: 'Pagoda', at: [59, 13, -16] },
  { name: 'Coliseo', at: [120, 12, -35] },
];

const C = {
  ground: 0xcfd8bd, campus: 0xb9cf9a, lawn: 0x5fae4a, lawn2: 0x67b552, grassField: 0x6cb251, bigField: 0x63a84a,
  path: 0xdcd5c6, asphalt: 0x5d6166, sand: 0xe6d3a3, water: 0x4f8a5e, stone: 0xb9b3a6,
  courtBlue: 0x2fa3d6, courtGreen: 0x3a9b6a,
  hallWall: 0xb5533c, hallRoof: 0x4a3530, espejoWall: 0xdcae95, espejoRoof: 0xe8987a,
  brick: 0xa9503b, darkRoof: 0x4b3a36, glassRoof: 0xa8bfcc, white: 0xf1efe8, whiteRoof: 0xc9c9c4,
  teal: 0x3f9c8e, pink: 0xe2b9a8, pagodaRoof: 0x3f8f6f, pagodaWall: 0xd8cbb0,
  brownRoof: 0x6b4a3f, cream: 0xd8c7ab, coliseoRoof: 0x8f9c8c, houseRoof: 0xe2814e, houseWall: 0xefe4d2,
  gold: 0xd4a72c, tree: 0x3f7f3a, treeLight: 0x5f9e45, treeDark: 0x2f6a3a, trunk: 0x7a5236, palm: 0x4f8f3a,
  red: 0xed1c24, black: 0x101010, pure: 0xffffff,
};

const V = (x, z, y = 0) => new THREE.Vector3(x, y, z);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;

// pseudoaleatorio determinista (el campus se ve igual en cada carga)
let seed = 7;
const rnd = (a = 0, b = 1) => { seed = (seed * 16807) % 2147483647; return a + (seed / 2147483647) * (b - a); };

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
  scene.fog = new THREE.Fog(0xeeeeed, 320, 560);

  const camera = new THREE.PerspectiveCamera(38, 1, 1, 900);
  // vista general: desde el sur, mirando el campus completo
  const narrow = canvasWrap.clientWidth < 520;
  const HOME = narrow
    ? { pos: new THREE.Vector3(40, 172, 166), target: new THREE.Vector3(36, 0, 6) }
    : { pos: new THREE.Vector3(30, 150, 184), target: new THREE.Vector3(28, 0, 2) };
  camera.position.copy(HOME.pos);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb38a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-90, 160, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1536 : 2048, coarse ? 1536 : 2048);
  Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 120, bottom: -120, near: 20, far: 420 });
  sun.shadow.bias = -0.0006;
  sun.target.position.set(26, 0, 0);
  scene.add(sun, sun.target);

  // ---------- helpers ----------
  const matCache = new Map();
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra }));
    return matCache.get(key);
  };
  const add = (mesh, { cast = true, receive = true } = {}) => { mesh.castShadow = cast; mesh.receiveShadow = receive; scene.add(mesh); return mesh; };

  // superficie plana rectangular (x1,z1)-(x2,z2)
  const flat = (x1, z1, x2, z2, color, h = 0.1, map) => {
    const w = x2 - x1, d = z2 - z1;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), map ? new THREE.MeshStandardMaterial({ map, roughness: 0.95 }) : mat(color));
    m.position.set(x1 + w / 2, h / 2, z1 + d / 2);
    return add(m, { cast: false });
  };
  // superficie plana con forma libre (lista de [x,z])
  const flatShape = (pts, color, h = 0.1, y = 0) => {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 8 });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat(color, { flatShading: false }));
    m.position.y = y;
    return add(m, { cast: false });
  };

  // edificio rectangular; roof: 'hip' (cuatro aguas), 'flat' o null
  const building = (x1, z1, x2, z2, h, wall, roofColor, roof = 'hip', roofH = 3) => {
    const w = x2 - x1, d = z2 - z1, cx = x1 + w / 2, cz = z1 + d / 2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(wall));
    body.position.set(cx, h / 2, cz); add(body);
    if (roof === 'hip') {
      const r = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1), mat(roofColor));
      r.rotation.y = Math.PI / 4; r.scale.set(w * 1.08, roofH, d * 1.08);
      r.position.set(cx, h + roofH / 2, cz); add(r);
    } else if (roof === 'flat') {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6), mat(roofColor));
      r.position.set(cx, h + 0.3, cz); add(r);
    }
    return { cx, cz, w, d, h };
  };

  const tree = (x, z, s = 1, color) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2 * s, 5), mat(C.trunk));
    t.position.set(x, s, z); add(t);
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9 * s, 0), mat(color ?? [C.tree, C.treeLight, C.treeDark][Math.floor(rnd(0, 3))]));
    c.position.set(x, 3.1 * s, z); c.rotation.y = rnd(0, 3); add(c);
  };
  const palmLeaf = new THREE.ConeGeometry(0.5, 3.6, 3);
  palmLeaf.rotateZ(Math.PI / 2); palmLeaf.translate(1.8, 0, 0); palmLeaf.scale(1, 0.25, 1);
  const palm = (x, z, s = 1) => {
    const h = 5.5 * s;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, h, 5), mat(0x8a7356));
    t.position.set(x, h / 2, z); add(t);
    for (let i = 0; i < 7; i++) {
      const l = new THREE.Mesh(palmLeaf, mat(C.palm));
      l.position.set(x, h, z); l.rotation.set(0, (i / 7) * Math.PI * 2 + rnd(0, .4), -0.35);
      l.scale.setScalar(s); add(l);
    }
  };

  const canvasTex = (w, h, draw) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };

  // ---------- terreno ----------
  // Distribución (de oeste a este): césped/cuadrángulos | Galileo | lago | Pagoda y torre | cancha sintética y tenis.
  // Franja sur: camino de palmeras → césped pequeño → vóley → césped grande → tenis.
  const base = new THREE.Mesh(new THREE.BoxGeometry(270, 2, 190), mat(C.ground));
  base.position.set(22, -1, 6); add(base, { cast: false });
  flat(-82, -58, 136, 58, C.campus, 0.06);                         // terreno del campus
  flat(-96, -90, -84, 100, C.asphalt, 0.08);                        // avenida al oeste
  flat(-90.3, -90, -89.7, 100, 0xf2c94c, 0.1);                      // línea amarilla
  flat(-84, 58, 136, 65, C.asphalt, 0.08);                           // calle al sur
  for (let x = 20; x < 28; x += 1.6) flat(x, 58, x + 0.8, 65, C.pure, 0.11); // paso cebra

  // ---------- campus oeste ----------
  // cuadrángulos: dos céspedes a cada lado del camino central de palmeras, que lleva recto a las gradas del Hall
  flat(-52, -8, -16, 12, C.lawn2, 0.14);                             // césped al norte
  flat(-56, 12, -16, 31, C.lawn, 0.14);                              // cuadrángulo norte
  flat(-56, 35, -16, 56, C.lawn2, 0.14);                             // cuadrángulo sur
  flat(-58, 31, -16, 35, C.path, 0.16);                              // camino central hacia el Hall
  flat(-16, 38, 30, 56, C.lawn, 0.14);                               // césped junto al paso cebra
  flat(-16, 31, 46, 37, C.path, 0.16);                               // camino de palmeras (continúa al este)
  const bed = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.4, 10), mat(0xb3433f));
  bed.position.set(-44, 0.3, 22); add(bed, { cast: false });
  for (let x = -52; x <= -20; x += 6.5) { palm(x, 29.5, 0.9); palm(x + 3, 36.5, 0.9); }
  for (let x = -12; x <= 42; x += 6) { palm(x, 29.5, 1); palm(x + 3, 38.5, 1); }
  for (let z = -6; z <= 50; z += 7) if (z < 22 || z > 44) tree(-54, z, 0.9);  // libre frente a las gradas
  // seto rojo a lo largo del camino
  flat(-16, 39.5, 30, 41, 0x8e2f3a, 0.9);

  // edificio al norte del césped
  building(-45, -26, -21, -13, 7, C.hallWall, C.hallRoof, 'hip', 4);
  // Hall Principal: al suroeste, al final del camino recto; pórtico con arcos + gradas hacia el este (la meta)
  building(-79, 22, -63, 44, 7, C.hallWall, C.hallRoof, 'hip', 4);
  building(-63, 27, -60, 39, 5, C.hallWall, C.hallRoof, 'flat');
  for (let i = 0; i < 3; i++) {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 2.4), mat(0x2b1d19));
    arch.position.set(-59.85, 1.6, 29 + i * 4); scene.add(arch);
  }
  for (let i = 0; i < 4; i++) {                                      // gradas
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 14 + i * 1.5), mat(0xd9d2c3));
    step.position.set(-59.4 + i * 1.1, 0.225 + (3 - i) * 0.45, 33); add(step);
  }
  // Espejo: techo salmón grande al noroeste
  building(-78, -52, -48, -26, 7, C.espejoWall, C.espejoRoof, 'hip', 5);
  building(-48, -48, -36, -30, 6, C.espejoWall, C.darkRoof, 'hip', 3);
  // franja de edificios bajos de techo verde azulado al oeste del césped
  building(-78, -18, -60, -2, 4, C.pink, C.teal, 'hip', 2.4);
  building(-78, 2, -60, 18, 4, C.pink, C.teal, 'hip', 2.4);
  // Galileo: gran techo café plano con tragaluces, entre el césped y el lago
  const gal = building(-13, -30, 15, 27, 7, C.brick, C.darkRoof, 'flat');
  [[-4, -18, 10, 6], [8, -20, 6, 8], [-2, 2, 12, 8], [8, 14, 6, 6], [-6, 16, 5, 5]].forEach(([x, z, w, d]) => {
    const sky = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), mat(C.glassRoof, { roughness: 0.3, metalness: 0.3 }));
    sky.position.set(x, gal.h + 0.9, z); add(sky);
  });
  const obs = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.white));
  obs.position.set(10, gal.h + 0.6, 22); add(obs);                    // cúpula pequeña de Galileo
  building(-20, -38, 4, -30, 6, C.brick, C.darkRoof, 'hip', 2.5);
  building(-14, -32, -4, -30.2, 5, C.white, C.teal, 'flat');
  // Einstein: blanco con cúpula dorada, al norte
  building(-14, -56, 6, -40, 9, C.white, C.whiteRoof, 'flat');
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 2.2, 16), mat(C.white));
  drum.position.set(-4, 10.7, -48); add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.gold, { metalness: 0.5, roughness: 0.35 }));
  dome.position.set(-4, 11.8, -48); add(dome);
  // Casa Blanca: techo verde, al norte del lago
  building(14, -54, 32, -40, 5, C.white, C.teal, 'hip', 3);

  // ---------- lago (dos partes con isla) ----------
  const lakeShape = (ctrl) => {
    const c = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), true);
    return c.getPoints(48).map(p => [p.x, p.z]);
  };
  const grow = (pts, k) => {
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return pts.map(([x, z]) => [x + (x - cx) * k, z + (z - cz) * k]);
  };
  const lakeN = lakeShape([[22, -26], [30, -28], [36, -22], [34, -12], [27, -9], [21, -15]]);
  const lakeS = lakeShape([[22, -4], [31, -7], [40, -1], [42, 10], [38, 20], [29, 24], [21, 18], [19, 6]]);
  [lakeN, lakeS].forEach(l => { flatShape(grow(l, 0.1), C.stone, 0.35); flatShape(l, C.water, 0.4, 0.02); });
  const island = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 0.7, 10), mat(C.lawn));
  island.position.set(26, 0.35, 8); add(island, { cast: false });
  tree(26, 8, 0.7);
  [[18, -30], [40, -28], [17, -8], [44, 2], [18, 26], [42, 24], [36, -34], [24, -34]].forEach(([x, z]) => tree(x, z, rnd(0.9, 1.25)));

  // ---------- campus este (deportes) ----------
  // casita de madera entre el lago y la Pagoda
  building(41, -10, 47, 0, 2.5, 0x8a7a68, 0x6d6158, 'hip', 1.6);
  // Pagoda: muros bajos + gran techo piramidal verde con linterna
  building(49, -26, 69, -6, 3.5, C.pagodaWall, null, null);
  const pr = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1), mat(C.pagodaRoof));
  pr.rotation.y = Math.PI / 4; pr.scale.set(23, 9, 23); pr.position.set(59, 3.5 + 4.5, -16); add(pr);
  const lantern = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.4, 4), mat(C.pagodaRoof));
  lantern.rotation.y = Math.PI / 4; lantern.position.set(59, 13.6, -16); add(lantern);
  // torre blanca entre la Pagoda y el césped grande
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 12, 3), mat(C.white)); tower.position.set(72, 6, -2); add(tower);
  const towerTop = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2, 4), mat(C.whiteRoof));
  towerTop.rotation.y = Math.PI / 4; towerTop.position.set(72, 13, -2); add(towerTop);
  building(64, -4, 70, 2, 3, 0xc9573f, 0x9c4a3f, 'hip', 1.5);       // casita de techo rojo junto a la torre

  // césped natural detrás (al norte) y cancha sintética (fútbol)
  flat(46, -54, 76, -30, C.grassField, 0.12);
  const fieldTex = canvasTex(520, 512, (g, w, h) => {
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#3f9e45' : '#4bac4f'; g.fillRect((w / 10) * i, 0, w / 10, h); }
    g.strokeStyle = '#fff'; g.lineWidth = 5;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.beginPath(); g.moveTo(w / 2, 16); g.lineTo(w / 2, h - 16); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 50, 0, Math.PI * 2); g.stroke();
    g.strokeRect(16, h / 2 - 100, 70, 200); g.strokeRect(w - 86, h / 2 - 100, 70, 200);
  });
  flat(76, -36, 104, -10, C.grassField, 0.16, fieldTex);
  [[75.3, -23], [104.7, -23]].forEach(([x, z]) => {
    const goal = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 3.6), new THREE.MeshStandardMaterial({ color: C.pure, wireframe: true }));
    goal.position.set(x, 0.85, z); scene.add(goal);
  });
  // canchas de tenis (puntería): dos canchas azules sobre fondo verde
  flat(100, -6, 126, 24, C.courtGreen, 0.14);
  const tennisTex = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#2fa3d6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 5;
    g.strokeRect(20, 20, w - 40, h - 40); g.strokeRect(48, 20, w - 96, h - 40);
    g.beginPath(); g.moveTo(48, h / 2 - 110); g.lineTo(w - 48, h / 2 - 110); g.moveTo(48, h / 2 + 110); g.lineTo(w - 48, h / 2 + 110);
    g.moveTo(w / 2, h / 2 - 110); g.lineTo(w / 2, h / 2 + 110); g.stroke();
  });
  [102.5, 113.5].forEach(x => {
    flat(x, -4, x + 10, 22, C.courtBlue, 0.18, tennisTex);
    const net = new THREE.Mesh(new THREE.BoxGeometry(10.4, 1, 0.1), new THREE.MeshStandardMaterial({ color: C.pure, wireframe: true }));
    net.position.set(x + 5, 0.7, 9); scene.add(net);
  });
  const targetTex = canvasTex(128, 128, g => {
    ['#ed1c24', '#fff', '#ed1c24', '#fff', '#ed1c24'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(64, 64, 62 - i * 12, 0, Math.PI * 2); g.fill(); });
  });
  [105, 110, 116, 121].forEach(x => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.15, 24), [mat(C.pure), new THREE.MeshStandardMaterial({ map: targetTex }), mat(C.pure)]);
    t.rotation.x = Math.PI / 2; t.position.set(x, 1.4, -3); add(t);
  });
  // franja sur: césped pequeño, vóley y césped grande
  flat(46, 4, 66, 30, C.lawn, 0.12);
  const sandTex = canvasTex(256, 200, (g, w, h) => {
    g.fillStyle = '#e6d3a3'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(22, 18, w - 44, h - 36);
  });
  flat(46, 36, 62, 52, C.sand, 0.18, sandTex);
  const vnet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 11), new THREE.MeshStandardMaterial({ color: C.pure, wireframe: true }));
  vnet.position.set(54, 1.8, 44); scene.add(vnet);
  [38.5, 49.5].forEach(z => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), mat(C.black)); p.position.set(54, 1.3, z); add(p); });
  flat(66, 8, 100, 52, C.bigField, 0.12);
  [[70, 30], [96, 30]].forEach(([x, z]) => {                       // arcos del césped grande
    const goal = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 4), new THREE.MeshStandardMaterial({ color: C.pure, wireframe: true }));
    goal.position.set(x, 0.9, z); scene.add(goal);
  });
  // caminos de la zona deportiva
  flat(43, -6, 46, 37, C.path, 0.15);
  flat(46, 1, 100, 4, C.path, 0.15);
  // edificios de techo café al este y Coliseo al noreste
  building(126, 6, 136, 46, 4, C.cream, C.brownRoof, 'hip', 3);
  building(104, 28, 124, 40, 3.5, C.cream, C.brownRoof, 'hip', 2.5);
  building(106, -52, 134, -18, 7, 0xd7d2c7, C.coliseoRoof, 'hip', 5);
  // árboles
  for (let x = 46; x <= 132; x += 7) tree(x + rnd(-2, 2), -56 + rnd(-2, 2), rnd(0.9, 1.2));
  [[74, 6], [100, 0], [62, 54], [100, 54], [40, 52], [32, 46], [68, 40], [128, -6]].forEach(([x, z]) => tree(x, z, rnd(0.9, 1.25)));

  // ---------- contexto: casas alrededor ----------
  const house = (x, z) => {
    const w = rnd(6, 10), d = rnd(6, 9), h = rnd(3, 7);
    building(x, z, x + w, z + d, h, C.houseWall, rnd() > 0.3 ? C.houseRoof : 0x9a9a92, rnd() > 0.25 ? 'hip' : 'flat', 2);
  };
  for (let z = -84; z <= 92; z += 13) house(rnd(-122, -114), z + rnd(-2, 2));
  for (let z = -82; z <= 92; z += 15) house(rnd(-110, -102), z + rnd(-2, 2));
  for (let x = -76; x <= 100; x += 14) house(x + rnd(-2, 2), rnd(-80, -68));
  for (let x = -76; x <= 128; x += 13) house(x + rnd(-2, 2), rnd(70, 80));

  // ---------- recorrido (línea roja) ----------
  const routePts = [[80, -6], [86, -22], [96, -14], [104, -8], [108, 9], [104, 26], [88, 30], [70, 38], [56, 44], [44, 40], [28, 34], [10, 34],
    [-8, 34], [-20, 33.5], [-33, 33], [-45, 33], [-55, 33]]
    .map(([x, z]) => V(x, z, 0.55));
  const curve = new THREE.CatmullRomCurve3(routePts, false, 'catmullrom', 0.35);
  add(new THREE.Mesh(new THREE.TubeGeometry(curve, 320, 0.55, 8, false), mat(C.red, { flatShading: false, emissive: 0x5a0306 })), { cast: false });

  // pareja que corre por la ruta
  const runners = [C.red, C.black].map(color => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.4, 4, 10), mat(color, { flatShading: false }));
    m.castShadow = true; scene.add(m); return m;
  });

  // ---------- estaciones: marcadores 3D ----------
  const PIN_H = 8.4;
  const pinGroups = STATIONS.map(st => {
    const g = new THREE.Group();
    const color = st.flag ? C.black : C.red;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), mat(C.black));
    stem.position.y = 3.5; g.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 14), mat(color, { flatShading: false, emissive: st.flag ? 0x000000 : 0x3a0002 }));
    head.position.y = PIN_H; head.castShadow = true; g.add(head);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.2, 8, 32), mat(color, { flatShading: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4; g.add(ring);
    g.position.copy(V(...st.at)); g.userData = { st, head, ring };
    scene.add(g); return g;
  });

  // etiquetas HTML (botones accesibles) que siguen a cada marcador
  const labels = STATIONS.map((st, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'm3d-pin' + (st.flag ? ' m3d-pin--meta' : ''); b.dataset.pin = st.id;
    b.innerHTML = st.flag
      ? `<b><svg aria-hidden="true"><use href="#i-finish"/></svg></b><span>${st.name}</span>`
      : `<b>${st.id}</b><span>${st.name}</span>`;
    b.setAttribute('aria-label', st.flag ? `${st.name}: ${st.where}. Ver en el mapa` : `Estación ${st.id}: ${st.name}. Ver en el mapa`);
    b.addEventListener('click', () => select(st.id));
    labelsEl.appendChild(b);
    return { el: b, group: pinGroups[i] };
  });
  // nombres de edificios (solo decorativos)
  const tags = TAGS.map(t => {
    const el = document.createElement('span');
    el.className = 'm3d-tag'; el.textContent = t.name; el.setAttribute('aria-hidden', 'true');
    labelsEl.appendChild(el);
    return { el, pos: V(t.at[0], t.at[2], t.at[1]) };
  });

  // ---------- controles ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.target);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 25; controls.maxDistance = 330;
  controls.maxPolarAngle = Math.PI * 0.44; controls.minPolarAngle = 0.15;
  controls.screenSpacePanning = false;
  controls.autoRotate = false; controls.autoRotateSpeed = 0.3;
  controls.enableZoom = false; // se activa al interactuar, para no secuestrar el scroll de la página
  controls.update();

  // ---------- recorrido automático ----------
  // Por defecto la cámara recorre lentamente: vista general → 1 → 2 → 3 → 4 → meta → vista general…
  // Se detiene en cuanto el usuario interactúa (arrastrar, rueda, botones, estaciones).
  let touring = true, fly = null;
  const TOUR = [null, ...STATIONS.map(s => s.id)];
  const TRAVEL = 3800, DWELL = 3400;
  let tourIdx = 0, tourNext = 0;
  root.classList.add('m3d-touring');
  function stopTour() {
    if (!touring) return;
    touring = false; controls.autoRotate = false; fly = null;   // cancela el vuelo del recorrido en curso
    root.classList.remove('m3d-touring');
  }
  controls.addEventListener('start', stopTour);
  if (!coarse) {
    // en táctil, deslizar el dedo para hacer scroll no debe cortar el recorrido
    renderer.domElement.addEventListener('wheel', stopTour, { passive: true });
    renderer.domElement.addEventListener('pointerdown', stopTour);
  }

  // en táctil: un toque "activa" el mapa; mientras tanto el dedo hace scroll normal
  const activate = () => { stopTour(); root.classList.add('m3d-active'); controls.enabled = true; controls.enableZoom = true; };
  if (coarse) {
    controls.enabled = false;
    root.querySelector('.m3d-activate')?.addEventListener('click', activate);
  } else {
    renderer.domElement.addEventListener('pointerdown', () => { controls.enableZoom = true; });
    renderer.domElement.addEventListener('pointerleave', () => { controls.enableZoom = false; });
  }

  // limitar el paneo al campus
  const clampTarget = () => {
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -80, 136);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -58, 62);
    controls.target.y = 0;
  };

  // ---------- animación de cámara ----------
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function flyTo(pos, target, ms = 1200, { force = false, ease = easeOut } = {}) {
    if (reduceMotion && !force) { fly = null; camera.position.copy(pos); controls.target.copy(target); controls.update(); return; }
    fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), ms, ease };
  }

  let active = null;
  function showStation(id, ms, opts) {
    active = id;
    const g = pinGroups.find(p => p.userData.st.id === id);
    const st = g.userData.st;
    const target = g.position.clone();
    const zoomOut = narrow ? 1.6 : 1.25;
    const pos = target.clone().add(new THREE.Vector3(...st.view).multiplyScalar(zoomOut));
    flyTo(pos, target, ms, opts);
    labels.forEach(l => l.el.classList.toggle('active', l.el.dataset.pin === id));
    info.hidden = false;
    const num = info.querySelector('.m3d-num');
    if (st.flag) num.innerHTML = '<svg aria-hidden="true" width="24" height="24"><use href="#i-finish"/></svg>';
    else num.textContent = st.id;
    info.querySelector('.m3d-name').textContent = st.name;
    info.querySelector('.m3d-desc').textContent = st.desc;
    info.querySelector('.m3d-where').textContent = st.where;
    onSelect?.(id);
  }
  function showHome(ms, opts) {
    active = null; info.hidden = true;
    labels.forEach(l => l.el.classList.remove('active'));
    flyTo(HOME.pos.clone(), HOME.target.clone(), ms, opts);
    onSelect?.(null);
  }
  function select(id) { stopTour(); if (coarse) activate(); showStation(id); }
  function reset() { stopTour(); showHome(); }
  function tourStep(now) {
    const id = TOUR[tourIdx];
    const opts = { force: true, ease: easeInOut };
    id ? showStation(id, TRAVEL, opts) : showHome(TRAVEL, opts);
    tourIdx = (tourIdx + 1) % TOUR.length;
    tourNext = now + TRAVEL + (id ? DWELL : DWELL + 1500);
  }
  function highlight(id) {
    labels.forEach(l => l.el.classList.toggle('hover', l.el.dataset.pin === id));
  }
  function zoom(f) {
    stopTour();
    const off = camera.position.clone().sub(controls.target).multiplyScalar(f);
    const len = THREE.MathUtils.clamp(off.length(), controls.minDistance, controls.maxDistance);
    flyTo(controls.target.clone().add(off.setLength(len)), controls.target.clone(), 450);
  }
  info.querySelector('.m3d-close').addEventListener('click', reset);
  root.querySelector('[data-m3d="reset"]').addEventListener('click', reset);
  root.querySelector('[data-m3d="in"]').addEventListener('click', () => zoom(0.7));
  root.querySelector('[data-m3d="out"]').addEventListener('click', () => zoom(1.35));

  // ---------- tamaño ----------
  const resize = () => {
    const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 520 ? 48 : 38;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvasWrap);
  resize();

  // ---------- loop (solo cuando está visible) ----------
  let visible = false, raf = 0;
  const v = new THREE.Vector3();
  const place = (el, pos, w, h) => {
    v.copy(pos).project(camera);
    el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
    el.style.visibility = v.z > 1 ? 'hidden' : 'visible';
  };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (touring) {
      if (!tourNext) tourNext = now + 2500; // pausa inicial en la vista general
      else if (now >= tourNext && !fly) tourStep(now);
      controls.autoRotate = !fly; // giro lento mientras se detiene en cada punto
    }
    if (fly) {
      const t = Math.min(1, (now - fly.start) / fly.ms), k = fly.ease(t);
      camera.position.lerpVectors(fly.p0, fly.p1, k);
      controls.target.lerpVectors(fly.t0, fly.t1, k);
      if (t === 1) fly = null;
    }
    controls.update(); clampTarget();
    const time = now / 1000;
    pinGroups.forEach((g, i) => {
      const on = g.userData.st.id === active;
      const s = THREE.MathUtils.lerp(g.scale.x, on ? 1.35 : 1, 0.15);
      g.scale.setScalar(s);
      g.userData.head.position.y = PIN_H + (reduceMotion ? 0 : Math.sin(time * 2 + i) * 0.35);
      g.userData.ring.scale.setScalar(1 + (reduceMotion ? 0 : (time * 0.8 + i * 0.25) % 1 * 0.6));
    });
    runners.forEach((r, i) => {
      const u = ((time * 0.012) + i * 0.006) % 1;
      curve.getPointAt(u, r.position);
      r.position.y = 1.5 + Math.abs(Math.sin(time * 9 + i * 1.6)) * (reduceMotion ? 0 : 0.5);
      r.position.x += i ? 0.9 : -0.9;
    });
    renderer.render(scene, camera);
    // posicionar etiquetas HTML
    const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
    labels.forEach(({ el, group }) => place(el, v.copy(group.position).setY((PIN_H + 2.2) * group.scale.y), w, h));
    const far = camera.position.distanceTo(controls.target) > 300;
    tags.forEach(({ el, pos }) => { place(el, pos, w, h); if (far) el.style.visibility = 'hidden'; });
  }
  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(root);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  root.classList.add('m3d-ready');
  return { select, reset, highlight };
}
