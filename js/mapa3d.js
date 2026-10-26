// Mapa 3D del circuito Dragon Rush (Three.js).
// Campus USFQ en estilo low-poly, armado a partir de la vista satelital (norte = -z) y las tomas aéreas:
//   norte: Hall Principal y Espejo, con los cuadrángulos al sur del Hall; centro: Galileo y La Laguna;
//   sur: vóley playa, Pagoda, El Obelisco, Coliseo Alexandros, canchas de tenis y Athletic Field.
// Coordenadas en unidades de mundo (x = este, z = sur). Distancias aproximadas.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// view = desde dónde mira la cámara al ir a esa estación (offset respecto al punto)
const STATIONS = [
  { id: '1', name: 'Fútbol', desc: 'Reto de precisión con balón.', where: 'Athletic Field', at: [-7, 89], view: [24, 32, 36] },
  { id: '2', name: 'Puntería', desc: 'Lanzamientos a zonas de puntaje.', where: 'Canchas de tenis', at: [-36, 83.5], view: [-10, 32, 40] },
  { id: '3', name: 'Vóley', desc: 'Reto de control y continuidad.', where: 'Cancha de vóley playa', at: [-26, 30], view: [22, 30, 34] },
  { id: '4', name: 'Resistencia', desc: 'Reto de fuerza y aguante.', where: 'Cuadrángulos', at: [-33.75, -30], view: [0, 30, 44] },
  { id: 'meta', name: 'Meta', desc: 'Suben las gradas y cruzan juntos.', where: 'Gradas del Hall Principal', at: [-33.75, -62], view: [14, 30, 46], flag: true },
];

const TAGS = [
  { name: 'Hall Principal', at: [-14, 11, -80] },
  { name: 'Espejo', at: [-25, 12, -99] },
  { name: 'Galileo', at: [18, 8.5, -26] },
  { name: 'Einstein', at: [70, 15.5, -80] },
  { name: 'Casa Blanca', at: [74, 6, -32] },
  { name: 'La Laguna', at: [36, 1.5, -2] },
  { name: 'Pagoda', at: [21, 12, 25] },
  { name: 'El Obelisco', at: [-12, 14.5, 46] },
  { name: 'Coliseo Alexandros', at: [22, 13, 54] },
  { name: 'Mozart', at: [-54, 7, 45] },
  { name: 'Planta Física', at: [-86, 6, -60] },
  { name: 'Stands auspiciantes', at: [-50, 6, -47] },
  { name: 'Diego de Robles', at: [-108, 0.5, -45] },
  { name: 'Av. Pampite', at: [40, 0.5, -120] },
  { name: 'Francisco de Orellana', at: [-90, 0.5, 103] },
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
  scene.fog = new THREE.Fog(0xeeeeed, 380, 660);

  const camera = new THREE.PerspectiveCamera(38, 1, 1, 900);
  // vista general: desde el sur, mirando el campus completo
  const narrow = canvasWrap.clientWidth < 520;
  const HOME = narrow
    ? { pos: new THREE.Vector3(-20, 190, 128), target: new THREE.Vector3(-22, 0, 4) }
    : { pos: new THREE.Vector3(-6, 180, 215), target: new THREE.Vector3(-8, 0, 6) };
  camera.position.copy(HOME.pos);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb38a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-90, 160, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1536 : 2048, coarse ? 1536 : 2048);
  Object.assign(sun.shadow.camera, { left: -170, right: 170, top: 150, bottom: -150, near: 20, far: 460 });
  sun.shadow.bias = -0.0006;
  sun.target.position.set(-15, 0, 0);
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
  // Distribución según la vista satelital (norte arriba = -z): Hall Principal al norte con los cuadrángulos
  // al sur; Galileo al este; La Laguna al sur de Galileo; Pagoda y Coliseo Alexandros al sur de la laguna;
  // vóley al suroeste; canchas de tenis y Athletic Field al sur; Diego de Robles al oeste.
  const base = new THREE.Mesh(new THREE.BoxGeometry(300, 2, 270), mat(C.ground));
  base.position.set(-25, -1, 0); add(base, { cast: false });
  flatShape([[-77, -112], [100, -112], [100, -48], [70, 112], [-10, 112], [-102, 94], [-125, 70]], C.campus, 0.06);

  // calles: segmento recto con ancho w entre (x1,z1) y (x2,z2)
  const road = (x1, z1, x2, z2, w, color = C.asphalt, h = 0.09) => {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, L), mat(color));
    m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2); m.rotation.y = Math.atan2(dx, dz);
    return add(m, { cast: false });
  };
  road(-74, -135, -134, 75, 12);                                      // Diego de Robles (oeste)
  road(-74, -135, -134, 75, 0.5, 0xf2c94c, 0.11);
  road(-150, -120, 120, -120, 9);                                     // Av. Pampite (norte)
  road(104, -116, 74, 130, 9);                                        // calle al este
  road(-150, 88, -4, 122, 10);                                        // Francisco de Orellana (sur)

  // ---------- norte: Hall Principal, Espejo, cuadrángulos ----------
  // Hall Principal: bloque de techo oscuro; pórtico con arcos y gradas hacia el sur (la meta)
  building(-46, -88, -6, -68, 7, C.hallWall, C.hallRoof, 'hip', 4);
  building(-39, -68, -28.5, -65, 5, C.hallWall, C.hallRoof, 'flat');
  for (let i = 0; i < 3; i++) {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.3), mat(0x2b1d19));
    arch.position.set(-37.75 + i * 4, 1.6, -64.85); scene.add(arch);
  }
  for (let i = 0; i < 4; i++) {                                       // gradas
    const step = new THREE.Mesh(new THREE.BoxGeometry(13 + i * 1.5, 0.45, 1.1), mat(0xd9d2c3));
    step.position.set(-33.75, 0.225 + (3 - i) * 0.45, -64.4 + i * 1.1); add(step);
  }
  // Espejo: techo salmón al norte del Hall
  building(-50, -108, 0, -90, 7, C.espejoWall, C.espejoRoof, 'hip', 5);
  // cuadrángulos: dos céspedes con el camino central de palmeras, recto hasta las gradas
  flat(-58, -62, -36.25, -10, C.lawn, 0.14);
  flat(-31.25, -62, -10, -10, C.lawn2, 0.14);
  flat(-36.25, -63, -31.25, -8, C.path, 0.16);
  for (let z = -58; z <= -14; z += 6.5) { palm(-38, z, 0.9); palm(-29.5, z + 3, 0.9); }
  // stands de auspiciantes a ambos lados del camino, entre la estación 4 y el Hall
  const tent = (x, z, roof, face) => {
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.6, 4), mat(roof));
    top.rotation.y = Math.PI / 4; top.position.set(x, 3.6, z); add(top);
    const valance = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.5, 3.8), mat(roof));
    valance.position.set(x, 2.6, z); add(valance);
    [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]].forEach(([dx, dz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 4), mat(0x8c9399));
      leg.position.set(x + dx, 1.3, z + dz); scene.add(leg);
    });
    const table = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 3), mat(C.pure));
    table.position.set(x + face * 1.2, 0.6, z); add(table);           // mesa mirando al camino
  };
  const tentColors = [C.red, C.pure, C.black, C.pure];
  [-57, -50, -43, -36].forEach((z, i) => {
    tent(-45, z, tentColors[i], 1);                                    // cuadrángulo oeste
    tent(-22, z, tentColors[(i + 1) % 4], -1);                         // cuadrángulo este
  });

  // ---------- personitas ----------
  // cuerpo (cápsula) + cabeza + brazos; `cheer` = brazos arriba. Se animan en el loop (saltan o se balancean).
  const SKIN = [0xf1c6a0, 0xd9a47a, 0xb07a52, 0x8a5a3c, 0xe8b894];
  const SHIRT = [C.red, C.black, C.pure, 0x2f5fd0, 0xf2c94c, 0x3a9b6a, 0xe2814e, C.red];
  const people = [];
  const person = (x, z, { cheer = false, jump = 0, sway = 0, face = 0 } = {}) => {
    const g = new THREE.Group();
    const shirt = SHIRT[Math.floor(rnd(0, SHIRT.length))];
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.1, 6), mat(0x2b2f3a));
    legs.position.y = 0.55; g.add(legs);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 3, 8), mat(shirt));
    body.position.y = 1.55; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), mat(SKIN[Math.floor(rnd(0, SKIN.length))], { flatShading: false }));
    head.position.y = 2.45; g.add(head);
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.95, 5), mat(shirt));
      arm.position.set(side * 0.52, cheer ? 2.35 : 1.45, 0);
      arm.rotation.z = cheer ? -side * 0.35 : side * 0.12;
      g.add(arm);
    });
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z); g.rotation.y = face;
    g.userData = { jump, sway, phase: rnd(0, Math.PI * 2), speed: rnd(5.5, 7.5) };
    scene.add(g); people.push(g);
    return g;
  };
  // meta: grupo saltando frente a las gradas del Hall, a ambos lados del camino
  [[-41, -58], [-39, -55.5], [-42.5, -54], [-38.5, -59], [-40.5, -52.5],
   [-28.5, -58], [-26.5, -55.5], [-29, -53], [-25, -58.5], [-27.5, -51.5]].forEach(([x, z]) =>
    person(x, z, { cheer: true, jump: 1.1, face: Math.atan2(-33.75 - x, -45 - z) + Math.PI }));
  // stands: una persona atendiendo detrás de la mesa y un visitante frente a cada carpa
  [-57, -50, -43, -36].forEach(z => {
    person(-45.6, z + rnd(-0.8, 0.8), { sway: 0.06, face: Math.PI / 2 });                // atiende (oeste)
    person(-41.3, z + rnd(-1, 1), { sway: 0.08, face: -Math.PI / 2 });                   // visita (oeste)
    person(-21.4, z + rnd(-0.8, 0.8), { sway: 0.06, face: -Math.PI / 2 });               // atiende (este)
    person(-25.7, z + rnd(-1, 1), { sway: 0.08, face: Math.PI / 2 });                    // visita (este)
  });
  // Planta Física: edificios largos de techo verde azulado junto a Diego de Robles
  building(-92, -74, -80, -46, 4, C.pink, C.teal, 'hip', 2.4);
  building(-84, -42, -72, -12, 4, C.pink, C.teal, 'hip', 2.4);
  building(-70, -30, -62, -8, 3.5, C.white, 0x9c4a3f, 'hip', 2);
  for (let z = -60; z <= -14; z += 9) tree(-64, z, 0.9);

  // ---------- centro y este: Galileo, laguna, edificios ----------
  const gal = building(-10, -65, 50, -16, 7, C.brick, C.darkRoof, 'flat');
  [[4, -52, 10, 6], [20, -40, 8, 8], [-2, -28, 10, 6]].forEach(([x, z, w, d]) => {
    const sky = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), mat(C.glassRoof, { roughness: 0.3, metalness: 0.3 }));
    sky.position.set(x, gal.h + 0.9, z); add(sky);
  });
  for (let x = 28; x <= 44; x += 4) for (let z = -58; z <= -34; z += 5) {   // paneles solares
    const pv = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 4.2), mat(0x23324a, { roughness: 0.4, metalness: 0.4 }));
    pv.position.set(x, gal.h + 0.75, z); add(pv);
  }
  const obs = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.white));
  obs.position.set(-4, gal.h + 0.6, -20); add(obs);
  building(34, -80, 56, -67, 5, C.white, C.teal, 'hip', 2.2);         // Darwin / museo
  // Einstein: cúpula dorada al noreste
  building(58, -92, 82, -64, 9, C.white, C.whiteRoof, 'flat');
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 2.2, 16), mat(C.white));
  drum.position.set(70, 10.7, -80); add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.gold, { metalness: 0.5, roughness: 0.35 }));
  dome.position.set(70, 11.8, -80); add(dome);
  building(64, -44, 84, -20, 5, C.white, C.whiteRoof, 'flat');        // Casa Blanca
  building(56, -14, 72, 10, 4, C.white, 0x9a9a92, 'hip', 2);
  building(58, 20, 76, 36, 4, C.espejoWall, C.houseRoof, 'hip', 2.5);

  // La Laguna: alargada de este a oeste, al sur de Galileo
  const lakeShape = (ctrl) => {
    const c = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), true);
    return c.getPoints(48).map(p => [p.x, p.z]);
  };
  const grow = (pts, k) => {
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return pts.map(([x, z]) => [x + (x - cx) * k, z + (z - cz) * k]);
  };
  const lake = lakeShape([[-4, -2], [2, -10], [16, -12], [32, -11], [46, -8], [50, -1], [44, 6], [28, 7], [12, 6], [2, 6]]);
  flatShape(grow(lake, 0.08), C.stone, 0.35); flatShape(lake, C.water, 0.4, 0.02);
  const island = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.7, 10), mat(C.lawn));
  island.position.set(24, 0.35, -2); add(island, { cast: false });
  tree(24, -2, 0.7);
  [[-8, -12], [-8, 4], [0, 12], [12, 12], [40, 12], [52, 6], [54, -10]].forEach(([x, z]) => tree(x, z, rnd(0.9, 1.25)));
  for (let x = -6; x <= 46; x += 7) palm(x, -14, 0.8);

  // ---------- sur: vóley, Pagoda, Obelisco, Coliseo, tenis, Athletic Field ----------
  // vóley playa
  const sandTex = canvasTex(256, 200, (g, w, h) => {
    g.fillStyle = '#e6d3a3'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(22, 18, w - 44, h - 36);
  });
  flat(-38, 21, -14, 39, C.sand, 0.18, sandTex);
  const vnet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 14), new THREE.MeshStandardMaterial({ color: C.pure, wireframe: true }));
  vnet.position.set(-26, 1.8, 30); scene.add(vnet);
  [23, 37].forEach(z => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), mat(C.black)); p.position.set(-26, 1.3, z); add(p); });
  [[-48, 22], [-48, 34], [-10, 18], [-28, 14], [-18, 14]].forEach(([x, z]) => palm(x, z, 1));
  building(-62, 0, -50, 12, 3.5, C.white, C.teal, 'hip', 2);         // Instituto Confucio
  // Pagoda: muros bajos + techo piramidal verde con linterna
  building(10, 16, 32, 34, 3.5, C.pagodaWall, null, null);
  const pr = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1), mat(C.pagodaRoof));
  pr.rotation.y = Math.PI / 4; pr.scale.set(25, 8, 21); pr.position.set(21, 3.5 + 4, 25); add(pr);
  const lantern = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.4, 4), mat(C.pagodaRoof));
  lantern.rotation.y = Math.PI / 4; lantern.position.set(21, 12.6, 25); add(lantern);
  // El Obelisco
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 12, 3), mat(C.white)); tower.position.set(-12, 6, 46); add(tower);
  const towerTop = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2, 4), mat(C.whiteRoof));
  towerTop.rotation.y = Math.PI / 4; towerTop.position.set(-12, 13, 46); add(towerTop);
  // Coliseo Alexandros
  building(0, 38, 44, 70, 7, 0xd7d2c7, C.coliseoRoof, 'hip', 6);
  // Mozart y edificios del suroeste
  building(-60, 35, -47, 55, 4.5, C.espejoWall, C.darkRoof, 'hip', 2.4);
  building(-68, 62, -55, 92, 4, C.cream, C.brownRoof, 'hip', 2.5);
  building(-96, 64, -70, 88, 6, 0xd9d4ca, 0x8c8f93, 'flat');           // Sócrates
  building(-118, 32, -92, 86, 6, C.white, C.teal, 'hip', 3);           // Aristóteles
  building(-104, 6, -72, 24, 5, C.white, C.teal, 'hip', 2.5);          // Miguel de Santiago
  // canchas de tenis (puntería)
  flat(-51, 66, -20.5, 101, C.courtGreen, 0.14);
  const tennisTex = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#2fa3d6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 5;
    g.strokeRect(20, 20, w - 40, h - 40); g.strokeRect(48, 20, w - 96, h - 40);
    g.beginPath(); g.moveTo(48, h / 2 - 110); g.lineTo(w - 48, h / 2 - 110); g.moveTo(48, h / 2 + 110); g.lineTo(w - 48, h / 2 + 110);
    g.moveTo(w / 2, h / 2 - 110); g.lineTo(w / 2, h / 2 + 110); g.stroke();
  });
  [-48.5, -35].forEach(x => {
    flat(x, 70, x + 11, 97, C.courtBlue, 0.18, tennisTex);
    const net = new THREE.Mesh(new THREE.BoxGeometry(11.4, 1, 0.1), new THREE.MeshStandardMaterial({ color: C.pure, wireframe: true }));
    net.position.set(x + 5.5, 0.7, 83.5); scene.add(net);
  });
  const targetTex = canvasTex(128, 128, g => {
    ['#ed1c24', '#fff', '#ed1c24', '#fff', '#ed1c24'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(64, 64, 62 - i * 12, 0, Math.PI * 2); g.fill(); });
  });
  [-46, -40, -32, -26].forEach(x => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.15, 24), [mat(C.pure), new THREE.MeshStandardMaterial({ map: targetTex }), mat(C.pure)]);
    t.rotation.x = Math.PI / 2; t.position.set(x, 1.4, 68.5); add(t);
  });
  // Athletic Field (fútbol, sintética) y césped al este
  const fieldTex = canvasTex(400, 560, (g, w, h) => {
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#3f9e45' : '#4bac4f'; g.fillRect(0, (h / 10) * i, w, h / 10); }
    g.strokeStyle = '#fff'; g.lineWidth = 5;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.beginPath(); g.moveTo(16, h / 2); g.lineTo(w - 16, h / 2); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 46, 0, Math.PI * 2); g.stroke();
    g.strokeRect(w / 2 - 90, 16, 180, 64); g.strokeRect(w / 2 - 90, h - 80, 180, 64);
  });
  flat(-19, 72, 5, 106, C.grassField, 0.16, fieldTex);
  [[-7, 72.7], [-7, 105.3]].forEach(([x, z]) => {
    const goal = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 0.6), new THREE.MeshStandardMaterial({ color: C.pure, wireframe: true }));
    goal.position.set(x, 0.85, z); scene.add(goal);
  });
  flat(6, 76, 36, 106, C.bigField, 0.12);
  // caminos
  flat(-44, 10, -40, 66, C.path, 0.15);                               // de los cuadrángulos al sur (junto a Mozart)
  flat(-44, -10, -10, -6, C.path, 0.15);
  // árboles del sur y del este
  [[-8, 30], [2, 34], [46, 40], [50, 60], [48, 78], [40, 104], [12, 72], [-30, 104], [-56, 100], [-48, 58], [-30, 46], [-20, 60], [60, 50], [62, 90]].forEach(([x, z]) => tree(x, z, rnd(0.9, 1.25)));

  // ---------- contexto: casas alrededor ----------
  const house = (x, z) => {
    const w = rnd(6, 10), d = rnd(6, 9), h = rnd(3, 7);
    building(x, z, x + w, z + d, h, C.houseWall, rnd() > 0.3 ? C.houseRoof : 0x9a9a92, rnd() > 0.25 ? 'hip' : 'flat', 2);
  };
  for (let z = -126; z <= 60; z += 13) { const rx = -74 - (z + 135) * 0.2857; house(rx - rnd(20, 26), z); house(rx - rnd(34, 40), z + 4); }
  for (let x = -60; x <= 100; x += 13) house(x + rnd(-2, 2), rnd(-132, -128));
  for (let z = -100; z <= 120; z += 13) { const rx = 104 - (z + 116) * 0.122; house(rx + rnd(8, 12), z); }

  // ---------- recorrido (línea roja) ----------
  const routePts = [[-7, 97], [-7, 89], [-14, 82], [-22, 80], [-36, 83.5], [-41, 76], [-42, 64], [-42, 48], [-36, 40], [-26, 30],
    [-36, 20], [-42, 8], [-38, -6], [-33.75, -12], [-33.75, -30], [-33.75, -46], [-33.75, -62]]
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
  controls.minDistance = 25; controls.maxDistance = 380;
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
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -110, 100);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -110, 110);
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
    // personitas: saltan en la meta, se balancean en los stands (con "reducir movimiento", a la mitad)
    const pAmp = reduceMotion ? 0.5 : 1;
    people.forEach(p => {
      const d = p.userData;
      if (d.jump) p.position.y = Math.abs(Math.sin(time * d.speed + d.phase)) * d.jump * pAmp;
      if (d.sway) p.rotation.z = Math.sin(time * 1.6 + d.phase) * d.sway * pAmp;
    });
    renderer.render(scene, camera);
    // posicionar etiquetas HTML
    const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
    labels.forEach(({ el, group }) => place(el, v.copy(group.position).setY((PIN_H + 2.2) * group.scale.y), w, h));
    const far = camera.position.distanceTo(controls.target) > (narrow ? 170 : 330);  // en celular, sin nombres en la vista general
    tags.forEach(({ el, pos }) => { place(el, pos, w, h); if (far) el.style.visibility = 'hidden'; });
  }
  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(root);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  root.classList.add('m3d-ready');
  return { select, reset, highlight };
}
