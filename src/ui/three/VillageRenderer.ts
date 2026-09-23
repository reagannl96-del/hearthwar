// Renders the 3D village: isometric camera, golden-hour light, clickable
// buildings, level badges, villagers, falling leaves, smoke and fire.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BUILDINGS } from '../../engine/data/buildings';
import type { BuildingId, Buildings, Units } from '../../engine/types';
import { buildModel, visualTier } from './buildings';
import { C, bake, box, disposeTree, mat, rng, setSeason, setTheme, type Season, type Theme } from './kit';
import { isRider, militiaman, person, plot, scaffold, troop, type TroopModel } from './props';
import { FOOT_LOOPS, PEOPLE_LOOPS, RIDE_LOOPS } from './paths';
import { wallGuardPosts } from './scene';
import { LAYOUT, OUTSIDE, WALL_R, buildScenery, buildTerrain, buildWall, buildingScale, heightAt } from './scene';

/** An army leaving or coming home, as far as the village scene cares. */
export interface MarchInfo {
  id: number;
  kind: 'out' | 'home';
  units: Units;
  /** game time it set off (out) or gets home (home) */
  at: number;
}

export interface VillageRendererOpts {
  onPick?: (b: BuildingId) => void;
  onHover?: (b: BuildingId | null, x: number, y: number) => void;
  showcase?: boolean;
  labels?: boolean;
  season?: Season;
  night?: boolean;
  /** the village hero's look */
  theme?: Theme;
}

interface Slot {
  key: string;
  group: THREE.Group;
  anchor: THREE.Vector3;
  radius: number;
  label?: HTMLDivElement;
}

const ALL: BuildingId[] = ['main', 'barracks', 'stable', 'workshop', 'academy', 'smithy', 'rally', 'statue', 'market', 'warehouse', 'hiding', 'watchtower', 'timber', 'claypit', 'ironmine', 'farm', 'wall'];

const TROOP_KINDS: TroopModel[] = ['spear', 'sword', 'axe', 'archer', 'scout', 'light', 'marcher', 'heavy', 'paladin', 'sorcerer', 'druid', 'goblin', 'necromancer', 'noble'];
const TUNICS = [0x8e3a1f, 0x2f5d99, 0x6f7c35, 0xc98f2e, 0x5a3a22, 0x7a2f4a, 0xd9c7a0];

/** default camera: polar angle, azimuth, distance */
const CAM: [number, number, number] = [0.93, 0.24, 320];

/**
 * The hammer's angle through one blow (radians about the shoulder, 1.8 = head resting on the timber):
 * a steady lift overhead, a quick strike down onto the wood, and a beat resting there.
 */
function hammerSwing(t: number): number {
  const p = t - Math.floor(t);
  if (p < 0.55) return 1.8 * (1 - Math.sin((p / 0.55) * Math.PI / 2));
  if (p < 0.72) { const q = (p - 0.55) / 0.17; return 1.8 * q * q; }
  return 1.8 - Math.sin(((p - 0.72) / 0.28) * Math.PI) * 0.06;
}

export class VillageRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private controls: OrbitControls;
  private slots = new Map<BuildingId, Slot>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hovered: BuildingId | null = null;
  private ring: THREE.Mesh;
  private clock = new THREE.Clock();
  private raf = 0;
  private visible = true;
  private disposed = false;
  private leaves!: THREE.InstancedMesh;
  private leafState: { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; s: number; spin: THREE.Vector3 }[] = [];
  private people: { g: THREE.Group; path: THREE.Vector3[]; t: number; speed: number; len: number }[] = [];
  private smoke: { src: THREE.Object3D; puffs: { m: THREE.Mesh; age: number; life: number }[] }[] = [];
  private labelLayer: HTMLDivElement;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private down: { x: number; y: number } | null = null;
  private color = 0xe0a526;
  private viewH = 74;
  private fireLight: THREE.PointLight;
  private lastBuildings: Buildings | null = null;
  private season: Season = 'fall';
  private night = false;
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private fill!: THREE.DirectionalLight;
  private lanterns: THREE.Object3D[] = [];
  private troops: { kind: TroopModel; g: THREE.Group; path: THREE.Vector3[]; t: number; speed: number; len: number }[] = [];
  private troopKey = '';
  private guards: THREE.Group | null = null;
  private guardKey = '';
  private units: Units = {};
  /** the sorcerer's arcane barrier: a faint dome over the village while he is at home */
  private barrier: THREE.Mesh | null = null;
  private barrierTime: { value: number } = { value: 0 };
  private marches: { members: THREE.Group[]; path: THREE.Vector3[]; t: number; len: number; fadeIn: number; fadeOut: number }[] = [];
  private marchSeen = new Set<number>();
  private builders = new Map<BuildingId, { g: THREE.Group; arms: THREE.Object3D[] }>();
  private militia: { g: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; delay: number; t: number; face: number; a: number }[] = [];
  private militiaOn = false;
  private motes: THREE.Object3D[] = [];

  constructor(private container: HTMLElement, private opts: VillageRendererOpts = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;
    renderer.domElement.classList.add('village3d-canvas');
    container.appendChild(renderer.domElement);

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'village3d-labels';
    container.appendChild(this.labelLayer);

    this.season = opts.season ?? 'fall';
    setSeason(this.season);
    setTheme(opts.theme ?? 'classic');
    const sky = new THREE.Color(this.season === 'winter' ? 0xdfe7ee : this.season === 'volcanic' ? 0x9a6a58 : 0xe8cf9f);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 260, 470);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1200);
    const [polar, azim, dist] = CAM;
    this.camera.position.set(Math.sin(polar) * Math.sin(azim) * dist, Math.cos(polar) * dist, Math.sin(polar) * Math.cos(azim) * dist);
    this.camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xfff0d8, 0x5b4a2e, 1.35);
    this.hemi = hemi;
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd29a, 2.6);
    this.sun = sun;
    sun.position.set(-90, 120, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -105; sc.right = 105; sc.top = 105; sc.bottom = -105; sc.near = 10; sc.far = 400;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb9c7ff, 0.35);
    fill.position.set(80, 60, -60);
    this.fill = fill;
    this.scene.add(fill);
    this.fireLight = new THREE.PointLight(0xff8a2a, 0, 22, 1.6);
    this.scene.add(this.fireLight);

    this.scene.add(buildTerrain());
    const scenery = buildScenery();
    this.scene.add(scenery);
    scenery.traverse((o) => { if (o.userData.mote) this.motes.push(o); });

    const ringGeo = new THREE.RingGeometry(0.86, 1, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.visible = false;
    this.ring.renderOrder = 2;
    this.scene.add(this.ring);

    this.initLeaves();
    this.setNight(!!opts.night);

    const controls = new OrbitControls(this.camera, renderer.domElement);
    if (import.meta.env.DEV) (window as unknown as { __vr: unknown }).__vr = this;
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minZoom = 0.75;
    controls.maxZoom = 4.2;
    controls.minPolarAngle = 0.55;
    controls.maxPolarAngle = 1.2;
    controls.screenSpacePanning = false;
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.zoomToCursor = true;
    controls.target.set(0, 0, 4);
    if (opts.showcase) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
      controls.enabled = false;
      this.camera.zoom = 0.95;
    }
    controls.addEventListener('change', () => {
      // keep the camera over the village
      const t = controls.target;
      const r = Math.hypot(t.x, t.z);
      if (r > 70) { t.x *= 70 / r; t.z *= 70 / r; }
    });
    this.controls = controls;

    const el = renderer.domElement;
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.io = new IntersectionObserver((es) => { this.visible = es.some((e) => e.isIntersecting); });
    this.io.observe(container);
    this.resize();
    this.loop();
  }

  // ---------- public ----------

  update(b: Buildings, constructing: Partial<Record<BuildingId, number>>, color: number, points = 0): void {
    this.color = color;
    for (const id of ALL) this.updateSlot(id, b[id], constructing[id] !== undefined);
    this.updatePeople(points);
    this.lastBuildings = { ...b };
    this.updateGuards();
    this.updateLabels(b, constructing);
    this.updateBuilders(constructing);
  }

  /** Moonlight, lit windows and lantern-carrying villagers. */
  setNight(n: boolean): void {
    this.night = n;
    const winter = this.season === 'winter';
    const volc = this.season === 'volcanic';
    const sky = new THREE.Color(n ? (winter ? 0x1c2638 : volc ? 0x2a1614 : 0x1a1d2e) : winter ? 0xdfe7ee : volc ? 0x9a6a58 : 0xe8cf9f);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color = sky;
    if (n) {
      this.hemi.color.set(0x6f82c0);
      this.hemi.groundColor.set(0x1c1a24);
      this.hemi.intensity = winter ? 0.75 : 0.55;
      this.sun.color.set(0x9fb6ff);
      this.sun.intensity = winter ? 0.9 : 0.7;
      this.fill.intensity = 0.1;
      this.renderer.toneMappingExposure = 1.15;
    } else {
      this.hemi.color.set(winter ? 0xf2f6ff : 0xfff0d8);
      this.hemi.groundColor.set(winter ? 0x8a8f99 : 0x5b4a2e);
      this.hemi.intensity = winter ? 1.1 : 1.35;
      this.sun.color.set(winter ? 0xfff2e0 : volc ? 0xffd2b4 : 0xffd29a);
      this.sun.intensity = winter ? 2.1 : 2.6;
      this.fill.intensity = 0.35;
      this.renderer.toneMappingExposure = 1.05;
    }
    // windows glow warm at night
    mat(C.window).emissive.set(n ? 0xffa53a : 0x000000);
    mat(C.window).emissiveIntensity = n ? 1.3 : 1;
    for (const l of this.lanterns) l.visible = n;
  }

  zoomBy(f: number): void {
    this.camera.zoom = Math.max(this.controls.minZoom, Math.min(this.controls.maxZoom, this.camera.zoom * f));
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  rotateBy(rad: number): void {
    const c = this.controls;
    const off = this.camera.position.clone().sub(c.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), rad);
    this.camera.position.copy(c.target).add(off);
    this.camera.lookAt(c.target);
    c.update();
  }

  resetView(): void {
    const [polar, azim, dist] = CAM;
    this.controls.target.set(0, 0, 4);
    this.camera.position.set(Math.sin(polar) * Math.sin(azim) * dist, Math.cos(polar) * dist, Math.sin(polar) * Math.cos(azim) * dist + 4);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  focus(id: BuildingId): void {
    const s = this.slots.get(id);
    if (!s) return;
    this.controls.target.set(s.anchor.x, 0, s.anchor.z);
    this.camera.zoom = Math.max(this.camera.zoom, 2.2);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  dispose(): void {
    this.barrier?.traverse((o) => { if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose(); });
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) o.geometry.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.labelLayer.remove();
  }

  // ---------- building slots ----------

  private updateSlot(id: BuildingId, level: number, building: boolean): void {
    const tier = visualTier(id, level);
    const key = `${tier}|${building ? 1 : 0}|${id === 'rally' || id === 'main' || id === 'watchtower' || id === 'wall' || id === 'barracks' ? this.color : ''}`;
    const cur = this.slots.get(id);
    if (cur && cur.key === key) return;
    if (cur) {
      this.scene.remove(cur.group);
      disposeTree(cur.group);
      this.smoke = this.smoke.filter((s) => {
        let inside = false;
        cur.group.traverse((o) => { if (o === s.src) inside = true; });
        if (inside) for (const p of s.puffs) { this.scene.remove(p.m); p.m.geometry.dispose(); }
        return !inside;
      });
    }
    const [x, z, ry] = LAYOUT[id];
    const y = OUTSIDE.includes(id) ? heightAt(x, z) : 0;
    let group: THREE.Group;
    let h = 4, radius = 5;
    if (id === 'wall') {
      group = buildWall(level, this.color);
      h = level >= 15 ? 11 : level >= 10 ? 9 : 6;
      radius = 3;
      const slot: Slot = { key, group, anchor: new THREE.Vector3(0, h, WALL_R + 1), radius };
      if (level <= 0) {
        const p = plot(4, 3);
        const baked = bake(p, { building: 'wall' });
        baked.position.set(0, 0, WALL_R);
        group.add(baked);
        slot.anchor.set(0, 2, WALL_R);
      }
      this.scene.add(group);
      this.slots.set(id, { ...slot, label: cur?.label });
      return;
    }
    const naturalAtZero = OUTSIDE.includes(id);
    if (level <= 0 && !naturalAtZero && !building) {
      const p = plot(id === 'statue' || id === 'hiding' ? 3.5 : 6, id === 'statue' || id === 'hiding' ? 3.5 : 5);
      group = bake(p, { building: id });
      h = 2.2;
      radius = 4;
    } else {
      const built = buildModel(id, Math.max(level, building && level === 0 ? 1 : level), this.color);
      const raw = built.obj;
      if (building) raw.add(scaffold(built.w + 0.6, built.d + 0.6, Math.max(3, Math.min(built.h - 2, 9))));
      if (level <= 0 && naturalAtZero) {
        // an untouched site outside the walls
        group = bake(raw, { building: id });
      } else group = bake(raw, { building: id });
      h = built.h;
      radius = Math.max(built.w, built.d) * 0.6;
    }
    // smoke emitters
    group.traverse((o) => {
      if (o.userData.smoke) this.smoke.push({ src: o, puffs: [] });
    });
    const scale = buildingScale(id);
    group.position.set(x, y, z);
    group.rotation.y = ry;
    group.scale.setScalar(scale);
    this.scene.add(group);
    this.slots.set(id, { key, group, anchor: new THREE.Vector3(x, y + h * scale, z), radius: radius * scale, label: cur?.label });
    if (id === 'rally') {
      const fire = new THREE.Vector3(2.6, 1.5, 1.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(x, 0, z));
      this.fireLight.position.copy(fire);
    }
  }

  // ---------- labels ----------

  private updateLabels(b: Buildings, constructing: Partial<Record<BuildingId, number>>): void {
    if (this.opts.labels === false) return;
    for (const id of ALL) {
      const s = this.slots.get(id);
      if (!s) continue;
      const lvl = b[id];
      const up = constructing[id];
      if (lvl <= 0 && up === undefined) {
        if (s.label) s.label.hidden = true;
        continue;
      }
      if (!s.label) {
        const el = document.createElement('div');
        el.className = 'lvl-badge';
        el.addEventListener('click', () => this.opts.onPick?.(id));
        el.title = BUILDINGS[id].name;
        this.labelLayer.appendChild(el);
        s.label = el;
      }
      s.label.hidden = false;
      s.label.textContent = String(lvl);
      s.label.classList.toggle('is-building', up !== undefined);
      s.label.dataset.id = id;
    }
  }

  private placeLabels(): void {
    if (this.opts.labels === false) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const v = new THREE.Vector3();
    for (const [id, s] of this.slots) {
      if (!s.label || s.label.hidden) continue;
      v.copy(s.anchor).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      s.label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      s.label.classList.toggle('is-hover', id === this.hovered);
    }
  }

  // ---------- people ----------

  private updatePeople(points: number): void {
    const want = this.opts.showcase ? 14 : Math.min(18, 3 + Math.floor(points / 180));
    const loops: THREE.Vector3[][] = PEOPLE_LOOPS.map((p) => p.map(([x, z]) => new THREE.Vector3(x, Math.hypot(x, z) > WALL_R ? heightAt(x, z) : 0, z)));
    while (this.people.length < want) {
      const r = rng(this.people.length * 97 + 5);
      const g = person(TUNICS[this.people.length % TUNICS.length]);
      g.scale.setScalar(1.3);
      const lantern = makeLantern();
      lantern.visible = this.night;
      g.add(lantern);
      this.lanterns.push(lantern);
      const path = loops[this.people.length % loops.length];
      const len = pathLength(path);
      this.people.push({ g, path, t: r() * len, speed: 1.2 + r() * 1.3, len });
      this.scene.add(g);
    }
    while (this.people.length > want) {
      const p = this.people.pop()!;
      this.lanterns = this.lanterns.filter((l) => l.parent !== p.g);
      this.scene.remove(p.g);
      disposeTree(p.g);
    }
  }

  /**
   * Some of the troops at home stroll around the village too: one of each kind
   * you have, two once you have a proper company of them.
   */
  setTroops(units: Units): void {
    this.units = units;
    this.updateGuards();
    this.updateBarrier();
    const want: TroopModel[] = [];
    for (const k of TROOP_KINDS) {
      const n = units[k] ?? 0;
      if (n > 0) want.push(k);
      if (n >= 100 && !['paladin', 'sorcerer', 'druid', 'goblin', 'necromancer', 'noble'].includes(k)) want.push(k);
    }
    const key = want.join(',');
    if (key === this.troopKey) return;
    this.troopKey = key;
    for (const t of this.troops) {
      this.scene.remove(t.g);
      disposeTree(t.g);
    }
    this.troops = [];
    const foot: THREE.Vector3[][] = FOOT_LOOPS.map((p) => p.map(([x, z]) => new THREE.Vector3(x, Math.hypot(x, z) > WALL_R ? heightAt(x, z) : 0, z)));
    const ride: THREE.Vector3[][] = RIDE_LOOPS.map((p) => p.map(([x, z]) => new THREE.Vector3(x, Math.hypot(x, z) > WALL_R ? heightAt(x, z) : 0, z)));
    want.forEach((kind, i) => {
      const r = rng(i * 131 + kind.length * 7);
      const g = troop(kind);
      g.scale.setScalar(1.3);
      const pool = isRider(kind) ? ride : foot;
      const path = pool[i % pool.length];
      const len = pathLength(path);
      this.troops.push({ kind, g, path, t: r() * len, speed: isRider(kind) ? 2.6 + r() * 1.2 : 1.1 + r() * 0.8, len });
      this.scene.add(g);
    });
  }

  /**
   * While a sorcerer is home the village sits under his arcane barrier. It is drawn
   * as a fresnel dome: nearly invisible where you look through it, a soft violet
   * glow only toward its edges, with faint bands of light drifting up it, so it
   * reads as a shield without fogging the village underneath.
   */
  private updateBarrier(): void {
    const on = (this.units.sorcerer ?? 0) > 0;
    if (on === !!this.barrier) return;
    if (!on) {
      this.scene.remove(this.barrier!);
      this.barrier!.traverse((o) => { if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose(); });
      disposeTree(this.barrier!);
      this.barrier = null;
      return;
    }
    const geo = new THREE.SphereGeometry(WALL_R + 5, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const matl = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: this.barrierTime, uColor: { value: new THREE.Color(0xa98bff) } },
      vertexShader: `
        varying vec3 vN; varying vec3 vView; varying float vH;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz);
          vH = position.y;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vView; varying float vH;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.2);
          float bands = 0.5 + 0.5 * sin(vH * 0.35 - uTime * 1.2);
          float a = rim * (0.3 + 0.14 * bands) + 0.02;
          gl_FragColor = vec4(mix(uColor, vec3(1.0), rim * 0.35), a);
        }`,
    });
    const dome = new THREE.Mesh(geo, matl);
    dome.userData.dynamic = true;
    dome.renderOrder = 10;
    // where the dome meets the ground, a thin ring of light
    const ring = new THREE.Mesh(new THREE.TorusGeometry(WALL_R + 5, 0.18, 6, 96), new THREE.MeshBasicMaterial({ color: 0xc9b3ff, transparent: true, opacity: 0.55, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    dome.add(ring);
    this.barrier = dome;
    this.scene.add(dome);
  }

  /** Archers and spearmen keeping watch from the wall, once it is big enough to stand on. */
  private updateGuards(): void {
    const level = this.lastBuildings?.wall ?? 0;
    const posts = wallGuardPosts(level);
    const archers = this.units.archer ?? 0, spears = this.units.spear ?? 0;
    const wantA = archers > 0 ? Math.min(4, 1 + Math.floor(archers / 150)) : 0;
    const wantS = spears > 0 ? Math.min(4, 1 + Math.floor(spears / 300)) : 0;
    // wooden towers only hold archers; stone walkways take both
    const onTowers = level < 10;
    const kinds: TroopModel[] = [];
    for (let i = 0; i < Math.max(wantA, wantS); i++) {
      if (i < wantA) kinds.push('archer');
      if (i < wantS && !onTowers) kinds.push('spear');
    }
    const n = Math.min(kinds.length, posts.length);
    const key = `${level >= 10 ? 'stone' : level >= 5 ? 'tower' : 'none'}:${kinds.slice(0, n).join(',')}`;
    if (key === this.guardKey) return;
    this.guardKey = key;
    if (this.guards) { this.scene.remove(this.guards); disposeTree(this.guards); this.guards = null; }
    if (n === 0) return;
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const p = posts[i];
      const t = troop(kinds[i]);
      t.scale.setScalar(1.3);
      t.position.set(p.x, p.y, p.z);
      t.rotation.y = p.face;
      t.userData.guard = i;
      g.add(t);
    }
    this.guards = g;
    this.scene.add(g);
  }

  // ---------- armies marching out and home ----------

  /**
   * Armies that just set off march out through the gate and vanish into the
   * forest down the road; armies about to get home come out of the trees.
   */
  setMarches(moves: MarchInfo[], now: number): void {
    for (const m of moves) {
      if (this.marchSeen.has(m.id)) continue;
      const age = m.kind === 'out' ? now - m.at : m.at - now;
      // only very fresh departures, and returns in their last stretch
      if (m.kind === 'out' ? age < 0 || age > 30_000 : age < 0 || age > 25_000) continue;
      this.marchSeen.add(m.id);
      const figures = marchFigures(m.units);
      if (figures.length === 0) continue;
      const road = MARCH_ROAD.map(([x, z]) => new THREE.Vector3(x, Math.hypot(x, z) > WALL_R ? heightAt(x, z) : 0, z));
      if (m.kind === 'home') road.reverse();
      const members = figures.map((k) => {
        const g = troop(k);
        g.scale.setScalar(1.3);
        g.visible = false;
        this.scene.add(g);
        return g;
      });
      const len = pathLength(road, false);
      this.marches.push({ members, path: road, t: 0, len, fadeIn: m.kind === 'home' ? 8 : 0, fadeOut: m.kind === 'out' ? len - 10 : len });
    }
    if (this.marchSeen.size > 500) this.marchSeen = new Set([...this.marchSeen].slice(-200));
  }

  private stepMarches(dt: number, t: number): void {
    const SPACING = 1.9, SPEED = 4.2;
    this.marches = this.marches.filter((m) => {
      m.t += SPEED * dt;
      let alive = false;
      m.members.forEach((g, i) => {
        const pt = m.t - i * SPACING;
        if (pt < 0 || pt > m.len) { g.visible = false; if (pt <= m.len) alive = true; return; }
        alive = true;
        const { pos, dir } = pointOnPath(m.path, pt);
        // two abreast, a little stagger so it reads as a column
        const side = (i % 2 === 0 ? 1 : -1) * 0.7;
        g.position.set(pos.x - dir.z * side, pos.y + Math.abs(Math.sin(t * 8 + i)) * 0.12, pos.z + dir.x * side);
        g.rotation.y = Math.atan2(dir.x, dir.z);
        const fade = pt < m.fadeIn ? pt / m.fadeIn : pt > m.fadeOut ? 1 - (pt - m.fadeOut) / (m.len - m.fadeOut) : 1;
        g.scale.setScalar(1.3 * Math.max(0.01, fade));
        g.visible = true;
      });
      if (!alive) for (const g of m.members) { this.scene.remove(g); disposeTree(g); }
      return alive;
    });
  }

  // ---------- militia ----------

  /** Called-up farmers pour out of the farm and line the wall, pitchforks raised. */
  setMilitia(on: boolean): void {
    if (on === this.militiaOn) return;
    this.militiaOn = on;
    for (const m of this.militia) { this.scene.remove(m.g); disposeTree(m.g); }
    this.militia = [];
    if (!on) return;
    const [fx, fz] = LAYOUT.farm;
    const toward = Math.atan2(fz, fx);
    const n = 20;
    for (let i = 0; i < n; i++) {
      const g = militiaman(TUNICS[i % TUNICS.length], i % 4 !== 3);
      g.scale.setScalar(1.3);
      // spread along the stretch of wall facing the farm, just outside it
      const a = toward + ((i / (n - 1)) - 0.5) * 1.5;
      const R = WALL_R + 3.4;
      const tx = Math.cos(a) * R, tz = Math.sin(a) * R;
      const sx = fx + (Math.sin(i * 7.3) * 3), sz = fz + (Math.cos(i * 5.1) * 3);
      const from = new THREE.Vector3(sx, heightAt(sx, sz), sz);
      const to = new THREE.Vector3(tx, heightAt(tx, tz), tz);
      g.position.copy(from);
      g.visible = false;
      this.scene.add(g);
      this.militia.push({ g, from, to, delay: i * 0.25, t: 0, face: Math.atan2(Math.cos(a), Math.sin(a)), a });
    }
  }

  private stepMilitia(dt: number, t: number): void {
    for (const m of this.militia) {
      m.t += dt;
      const k = Math.min(1, Math.max(0, (m.t - m.delay) / 9));
      m.g.visible = m.t > m.delay;
      if (k < 1) {
        // running out of the farm towards the wall
        m.g.position.lerpVectors(m.from, m.to, k);
        m.g.position.y = m.from.y + (m.to.y - m.from.y) * k + Math.abs(Math.sin(t * 11 + m.delay * 3)) * 0.25;
        m.g.rotation.y = Math.atan2(m.to.x - m.from.x, m.to.z - m.from.z);
      } else {
        // at the wall: pacing back and forth along it, stopping now and then to shake a pitchfork outward
        const s = m.delay * 3.1;
        const drift = Math.sin(t * 0.32 + s) * 0.07 + Math.sin(t * 0.11 + s * 2) * 0.05;
        const speed = Math.cos(t * 0.32 + s) * 0.32 * 0.07 + Math.cos(t * 0.11 + s * 2) * 0.11 * 0.05;
        const ang = m.a + drift;
        const R = Math.hypot(m.to.x, m.to.z) + Math.sin(t * 0.5 + s) * 0.6;
        const x = Math.cos(ang) * R, z = Math.sin(ang) * R;
        const walking = Math.abs(speed) > 0.006;
        m.g.position.set(x, heightAt(x, z) + (walking ? Math.abs(Math.sin(t * 8 + s)) * 0.1 : Math.abs(Math.sin(t * 5 + s)) * 0.12), z);
        // face the way they walk, or out over the fields when they pause
        const tangent = Math.atan2(-Math.sin(ang) * Math.sign(speed), Math.cos(ang) * Math.sign(speed));
        m.g.rotation.y = walking ? tangent : m.face + Math.sin(t * 2 + s) * 0.2;
      }
    }
  }

  // ---------- builders at work ----------

  /** A couple of villagers hammer away at every building being upgraded. */
  private updateBuilders(constructing: Partial<Record<BuildingId, number>>): void {
    for (const [id, b] of this.builders) {
      if (constructing[id] !== undefined) continue;
      this.scene.remove(b.g);
      disposeTree(b.g);
      this.builders.delete(id);
    }
    for (const id of Object.keys(constructing) as BuildingId[]) {
      if (this.builders.has(id) || id === 'wall') continue;
      const slot = this.slots.get(id);
      if (!slot) continue;
      const [x, z] = LAYOUT[id];
      const g = new THREE.Group();
      const arms: THREE.Object3D[] = [];
      // stand on the plaza side of the building, just clear of it
      const dx = 0 - x, dz = 4 - z;
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d, uz = dz / d;
      const r = slot.radius * 0.85 + 2.2;
      for (const side of [-1, 1]) {
        const w = person(side < 0 ? 0x8e3a1f : 0x6f7c35);
        const arm = new THREE.Group();
        arm.position.set(0.3, 1.0, 0);
        arm.add(box(0.07, 0.75, 0.07, 0x6e4a2a, 0, 0, 0.0));
        // the head runs along the swing, so the face comes down square on the work
        arm.add(box(0.16, 0.17, 0.36, 0x5d6b75, 0, 0.72, 0.04));
        w.add(arm);
        arms.push(arm);
        // the timber they are working, on a trestle right where the hammer comes down
        w.add(box(1.0, 0.16, 0.24, 0xa0703c, 0.15, 0.46, 0.8));
        w.add(box(0.9, 0.03, 0.02, 0xc98f55, 0.15, 0.62, 0.69));
        for (const lx of [-0.25, 0.55]) w.add(box(0.08, 0.46, 0.3, 0x6e4a2a, lx, 0, 0.8));
        const px = x + ux * r - uz * side * 1.3, pz = z + uz * r + ux * side * 1.3;
        w.position.set(px, OUTSIDE.includes(id) ? heightAt(px, pz) : 0, pz);
        w.rotation.y = Math.atan2(-ux, -uz);
        w.scale.setScalar(1.3);
        g.add(w);
      }
      this.scene.add(g);
      this.builders.set(id, { g, arms });
    }
  }

  // ---------- leaves ----------

  private initLeaves(): void {
    const snow = this.season === 'winter';
    const n = snow ? 420 : 140;
    const geo = snow ? new THREE.IcosahedronGeometry(0.16, 0) : new THREE.PlaneGeometry(0.55, 0.38);
    const m = snow ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    this.leaves = new THREE.InstancedMesh(geo, m, n);
    this.leaves.castShadow = false;
    const ash = this.season === 'volcanic';
    const cols = snow ? [0xffffff, 0xf2f6fb, 0xe6eef7] : ash ? [0x8a8480, 0x6e6864, 0xa09a94, 0xff7a2a] : [C.leafOrange, C.leafRed, C.leafYellow, C.leafGold];
    const r = rng(99);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      col.set(cols[i % cols.length]);
      this.leaves.setColorAt(i, col);
      this.leafState.push({
        p: new THREE.Vector3((r() - 0.5) * 150, r() * 40, (r() - 0.5) * 150),
        v: snow ? new THREE.Vector3(0.3 + r() * 0.5, -(1.6 + r() * 1.4), 0.1 + r() * 0.3) : new THREE.Vector3(0.8 + r() * 1.2, -(1.1 + r() * 1.1), 0.3 + r() * 0.6),
        r: new THREE.Euler(r() * 6, r() * 6, r() * 6),
        s: 0.8 + r() * 0.8,
        spin: new THREE.Vector3(r() * 2, r() * 2, r() * 2),
      });
    }
    this.scene.add(this.leaves);
  }

  private stepLeaves(dt: number, t: number): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < this.leafState.length; i++) {
      const L = this.leafState[i];
      L.p.x += (L.v.x + Math.sin(t * 0.7 + i) * 0.8) * dt;
      L.p.y += L.v.y * dt;
      L.p.z += (L.v.z + Math.cos(t * 0.5 + i * 1.3) * 0.6) * dt;
      L.r.x += L.spin.x * dt;
      L.r.y += L.spin.y * dt;
      L.r.z += L.spin.z * dt;
      if (L.p.y < 0.1 || L.p.x > 90) {
        L.p.set(-80 + Math.random() * 120, 25 + Math.random() * 20, -70 + Math.random() * 140);
      }
      q.setFromEuler(L.r);
      s.setScalar(L.s);
      m.compose(L.p, q, s);
      this.leaves.setMatrixAt(i, m);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
  }

  // ---------- interaction ----------

  private pick(e: PointerEvent): BuildingId | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const objs: THREE.Object3D[] = [];
    for (const s of this.slots.values()) objs.push(s.group);
    const hits = this.raycaster.intersectObjects(objs, true);
    for (const h of hits) {
      const id = h.object.userData.building as BuildingId | undefined;
      if (id) return id;
    }
    return null;
  }

  private onMove = (e: PointerEvent) => {
    if (this.opts.showcase) return;
    if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) {
      this.setHover(null, e);
      return;
    }
    this.setHover(this.pick(e), e);
  };

  private setHover(id: BuildingId | null, e: PointerEvent) {
    if (id !== this.hovered) {
      this.hovered = id;
      this.renderer.domElement.style.cursor = id ? 'pointer' : '';
      const s = id ? this.slots.get(id) : undefined;
      if (s && id !== 'wall') {
        this.ring.visible = true;
        this.ring.position.set(s.anchor.x, (OUTSIDE.includes(id!) ? heightAt(s.anchor.x, s.anchor.z) : 0) + 0.15, s.anchor.z);
        this.ring.scale.setScalar(s.radius + 1.2);
      } else this.ring.visible = false;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.opts.onHover?.(id, e.clientX - rect.left, e.clientY - rect.top);
  }

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || this.opts.showcase || e.button !== 0) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const id = this.pick(e);
    if (id) this.opts.onPick?.(id);
  };

  private onLeave = (e: PointerEvent) => {
    this.down = null;
    this.setHover(null, e);
  };

  // ---------- frame ----------

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const vh = this.viewH * (aspect < 1 ? 1.25 : 1);
    this.camera.left = (-vh * aspect) / 2;
    this.camera.right = (vh * aspect) / 2;
    this.camera.top = vh / 2;
    this.camera.bottom = -vh / 2;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) {
      this.clock.getDelta();
      return;
    }
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.controls.update();
    this.animate(dt, t);
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  };

  private animate(dt: number, t: number): void {
    // spinning, waving, flickering bits
    for (const s of this.slots.values()) {
      s.group.traverse((o) => {
        if (o.userData.spin) o.rotation.z += dt * 0.9;
        else if (o.userData.flag) o.rotation.y = Math.sin(t * 2.2 + o.id) * 0.35;
        else if (o.userData.fire) {
          const k = 1 + Math.sin(t * 17 + o.id) * 0.12 + Math.sin(t * 7.3) * 0.08;
          o.scale.set(1, k, 1);
        }
      });
    }
    this.fireLight.intensity = this.lastBuildings && this.lastBuildings.rally > 0 ? (18 + Math.sin(t * 13) * 4 + Math.sin(t * 5.1) * 3) * (this.night ? 3 : 1) : 0;
    if (this.night) for (const l of this.lanterns) l.children[2].scale.setScalar(2.4 + Math.sin(t * 9 + l.id) * 0.25);
    // hover ring pulse
    if (this.ring.visible) (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 5) * 0.3;
    // villagers
    for (const p of this.people) {
      p.t = (p.t + p.speed * dt) % p.len;
      const { pos, dir } = pointOnPath(p.path, p.t);
      p.g.position.set(pos.x, pos.y + Math.abs(Math.sin(t * 9 + p.speed * 10)) * 0.12, pos.z);
      p.g.rotation.y = Math.atan2(dir.x, dir.z);
    }
    for (const p of this.troops) {
      p.t = (p.t + p.speed * dt) % p.len;
      const { pos, dir } = pointOnPath(p.path, p.t);
      const bob = isRider(p.kind) ? Math.abs(Math.sin(t * 7 + p.speed * 10)) * 0.2 : Math.abs(Math.sin(t * 8 + p.speed * 10)) * 0.1;
      p.g.position.set(pos.x, pos.y + bob, pos.z);
      p.g.rotation.y = Math.atan2(dir.x, dir.z);
    }
    if (this.guards) for (const gd of this.guards.children) gd.rotation.y += Math.sin(t * 0.6 + (gd.userData.guard as number) * 1.7) * 0.004;
    for (const b of this.builders.values()) b.arms.forEach((a, i) => { a.rotation.x = hammerSwing(t * 1.4 + i * 0.47); });
    this.stepMarches(dt, t);
    this.stepMilitia(dt, t);
    this.barrierTime.value = t;
    for (const m of this.motes) {
      const d = m.userData.mote as { x: number; y: number; z: number; phase: number; speed: number };
      const p = t * d.speed + d.phase;
      m.position.set(d.x + Math.sin(p * 0.7) * 1.2, d.y + Math.sin(p) * 0.6, d.z + Math.cos(p * 0.5) * 1.2);
      m.scale.setScalar(0.7 + Math.abs(Math.sin(p * 2.3)) * 0.6);
    }
    this.stepLeaves(dt, t);
    // smoke puffs
    for (const s of this.smoke) {
      if (s.puffs.length < 7 && Math.random() < dt * 2.2) {
        const m = new THREE.Mesh(PUFF_GEO, new THREE.MeshLambertMaterial({ color: 0xcfc6b8, transparent: true, opacity: 0.6, flatShading: true }));
        s.src.getWorldPosition(m.position);
        this.scene.add(m);
        s.puffs.push({ m, age: 0, life: 3 + Math.random() * 1.5 });
      }
      s.puffs = s.puffs.filter((p) => {
        p.age += dt;
        const k = p.age / p.life;
        p.m.position.y += dt * 1.6;
        p.m.position.x += dt * 0.7;
        p.m.scale.setScalar(0.6 + k * 1.8);
        (p.m.material as THREE.MeshLambertMaterial).opacity = 0.55 * (1 - k);
        if (k >= 1) {
          this.scene.remove(p.m);
          (p.m.material as THREE.Material).dispose();
          return false;
        }
        return true;
      });
    }
  }
}

const PUFF_GEO = new THREE.IcosahedronGeometry(0.7, 0);

let glowTex: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,220,140,1)');
  grad.addColorStop(0.25, 'rgba(255,170,60,0.55)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/** A little lantern held out at arm's length, with a soft halo. */
function makeLantern(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  body.position.set(0.32, 0.72, 0.18);
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04), new THREE.MeshBasicMaterial({ color: 0x2a1a0e }));
  pole.position.set(0.32, 0.95, 0.18);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.set(2.6, 2.6, 1);
  halo.position.copy(body.position);
  const pool = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 }));
  pool.scale.set(4.5, 4.5, 1);
  pool.position.set(0.3, 0.05, 0.2);
  g.add(body, pole, halo, pool);
  return g;
}


function pathLength(p: THREE.Vector3[], closed = true): number {
  let l = 0;
  for (let i = 0; i < (closed ? p.length : p.length - 1); i++) l += p[i].distanceTo(p[(i + 1) % p.length]);
  return l;
}

/** From the plaza, out through the gate, down the road and off into the trees. */
const MARCH_ROAD: [number, number][] = [[0, 11], [0, 44], [0, 72], [-5, 84], [-16, 96]];

/** A few figures that stand for an army: its biggest contingents, up to six. */
function marchFigures(units: Units): TroopModel[] {
  const map: Partial<Record<keyof Units, TroopModel>> = {
    spear: 'spear', sword: 'sword', axe: 'axe', archer: 'archer', scout: 'scout', light: 'light', marcher: 'marcher',
    heavy: 'heavy', paladin: 'paladin', sorcerer: 'sorcerer', druid: 'druid', goblin: 'goblin', noble: 'noble', ram: 'axe', catapult: 'axe',
  };
  const kinds = (Object.entries(units) as [keyof Units, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = kinds.reduce((a, [, n]) => a + n, 0);
  const n = Math.min(6, Math.max(2, Math.round(Math.log10(total + 1) * 2)));
  const out: TroopModel[] = [];
  for (let i = 0; out.length < n && kinds.length; i++) {
    const m = map[kinds[i % kinds.length][0]];
    if (m) out.push(m);
    if (i > 20) break;
  }
  // the heroes and noblemen always ride along if present
  for (const [k] of kinds) { const m = map[k]; if (m && ['paladin', 'sorcerer', 'druid', 'goblin', 'necromancer', 'noble'].includes(m) && !out.includes(m)) out.push(m); }
  return out;
}

function pointOnPath(p: THREE.Vector3[], t: number): { pos: THREE.Vector3; dir: THREE.Vector3 } {
  let acc = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const d = a.distanceTo(b);
    if (acc + d >= t) {
      const k = (t - acc) / d;
      return { pos: a.clone().lerp(b, k), dir: b.clone().sub(a).normalize() };
    }
    acc += d;
  }
  return { pos: p[0].clone(), dir: new THREE.Vector3(0, 0, 1) };
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
