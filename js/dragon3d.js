// Dragón 3D del hero: la silueta del logo (js/dragon-shape.js) extruida con Three.js.
// Reacciona al cursor sobre el hero, se gira arrastrándolo (con inercia), da una vuelta al hacer clic
// y en celular gira lento y responde al scroll.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import DRAGON from './dragon-shape.js?v=2';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;

export function initDragon3D(mount, hero) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 6.2);

  // luces: clave cálida, contraluz rojo para recortar el borde sobre el fondo rojo
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2); key.position.set(-3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff3a40, 3.5); rim.position.set(4, 1, -4); scene.add(rim);
  const fill = new THREE.PointLight(0xffffff, 6, 12); fill.position.set(2, -2, 3); scene.add(fill);

  // ---------- geometría ----------
  const shapes = DRAGON.map(({ outer, holes }) => {
    const s = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    holes.forEach(h => s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))));
    return s;
  });
  // más delgado y con bisel redondeado; normales suavizadas en los costados (sin bandas) pero con aristas nítidas
  const depth = 0.14;
  let geo = new THREE.ExtrudeGeometry(shapes, {
    depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.014, bevelSegments: 6, curveSegments: 1,
  });
  geo.translate(0, 0, -depth / 2);
  geo = toCreasedNormals(geo, Math.PI / 4);

  // caras: negro brillante (contrasta con el hero rojo); laterales y bisel: rojo metálico del logo
  const faceMat = new THREE.MeshPhysicalMaterial({ color: 0x121212, metalness: 0.5, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: 0.9 });
  const sideMat = new THREE.MeshPhysicalMaterial({ color: 0xe0161e, metalness: 0.55, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.25, emissive: 0x2a0002, envMapIntensity: 0.8 });
  const dragon = new THREE.Mesh(geo, [faceMat, sideMat]);

  const pivot = new THREE.Group();
  pivot.add(dragon);
  scene.add(pivot);

  // ---------- interacción ----------
  const state = {
    tx: 0, ty: 0,          // inclinación objetivo por cursor
    rx: 0, ry: 0,          // inclinación actual
    spin: 0, vel: 0,       // giro por arrastre/clic con inercia
    dragging: false, lastX: 0, moved: 0,
    scroll: 0,
  };

  // seguir el cursor en todo el hero
  hero.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = hero.getBoundingClientRect();
    state.ty = ((e.clientX - r.left) / r.width - 0.5) * 0.9;
    state.tx = ((e.clientY - r.top) / r.height - 0.5) * 0.5;
  });
  hero.addEventListener('pointerleave', () => { state.tx = 0; state.ty = 0; });

  // arrastrar para girar (solo con mouse/lápiz; en táctil el dedo hace scroll)
  const canvas = renderer.domElement;
  if (!coarse) {
    canvas.addEventListener('pointerdown', e => {
      state.dragging = true; state.lastX = e.clientX; state.moved = 0;
      canvas.setPointerCapture(e.pointerId); mount.classList.add('grabbing');
    });
    canvas.addEventListener('pointermove', e => {
      if (!state.dragging) return;
      const dx = e.clientX - state.lastX; state.lastX = e.clientX; state.moved += Math.abs(dx);
      state.vel = dx * 0.012; state.spin += state.vel;
    });
    const up = () => {
      if (!state.dragging) return;
      state.dragging = false; mount.classList.remove('grabbing');
      if (state.moved < 4) state.vel = 0.32; // clic: da una vuelta
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }
  window.addEventListener('scroll', () => { state.scroll = window.scrollY; }, { passive: true });

  // ---------- tamaño ----------
  const resize = () => {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // encuadre: que el dragón (≈2 unidades de alto) entre con margen
    const fit = 2.25 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.z = Math.max(fit, fit / camera.aspect * 0.95);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(mount);
  resize();

  // ---------- loop ----------
  let raf = 0, visible = true, t0 = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    const k = 0.08;
    state.rx += (state.tx - state.rx) * k;
    state.ry += (state.ty - state.ry) * k;
    if (!state.dragging) {
      state.spin += state.vel;
      state.vel *= 0.95;
      // vuelve suavemente al frente cuando no hay inercia
      if (Math.abs(state.vel) < 0.002) {
        const target = Math.round(state.spin / (Math.PI * 2)) * Math.PI * 2;
        state.spin += (target - state.spin) * 0.04;
      }
    }
    // movimiento en reposo; con "reducir movimiento" se mantiene pero a la mitad
    const amp = reduceMotion ? 0.5 : 1;
    const idleY = coarse ? t * 0.35 * amp : Math.sin(t * 0.6) * 0.18 * amp;  // en celular gira lento continuo
    const idleFloat = Math.sin(t * 1.1) * 0.06 * amp;
    const scrollTilt = coarse ? state.scroll * 0.004 : 0;       // en celular responde al scroll
    pivot.rotation.set(state.rx + 0.05, state.ry + state.spin + idleY + scrollTilt, Math.sin(t * 0.5) * 0.03 * amp);
    pivot.position.y = idleFloat;
    renderer.render(scene, camera);
  }
  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(mount);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();

  mount.classList.add('ready');
  return { renderer };
}
