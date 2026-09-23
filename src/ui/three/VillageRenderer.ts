// Renders the 3D village: isometric camera, golden-hour light, clickable
// buildings, level badges, villagers, falling leaves, smoke and fire.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BUILDINGS } from '../../engine/data/buildings';
import type { BuildingId, Buildings, Units } from '../../engine/types';
import { buildModel, visualTier } from './buildings';
import { C, bake, disposeTree, mat, rng, setSeason, type Season } from './kit';
import { isRider, person, plot, scaffold, troop, type TroopModel } from './props';
import { LAYOUT, WALL_R, buildScenery, buildTerrain, buildWall, heightAt } from './scene';

export interface VillageRendererOpts {
  onPick?: (b: BuildingId) => void;
  onHover?: (b: BuildingId | null, x: number, y: number) => void;
  showcase?: boolean;
  labels?: boolean;
  season?: Season;
  night?: boolean;
}

interface Slot {
  key: string;
  group: THREE.Group;
  anchor: THREE.Vector3;
  radius: number;
  label?: HTMLDivElement;
}

const OUTSIDE: BuildingId[] = ['timber', 'claypit', 'ironmine', 'farm'];
const ALL: BuildingId[] = ['main', 'barracks', 'stable', 'workshop', 'academy', 'smithy', 'rally', 'statue', 'market', 'warehouse', 'hiding', 'watchtower', 'timber', 'claypit', 'ironmine', 'farm', 'wall'];

const TROOP_KINDS: TroopModel[] = ['spear', 'sword', 'axe', 'archer', 'scout', 'light', 'marcher', 'heavy', 'paladin', 'sorcerer', 'druid', 'goblin', 'noble'];
const TUNICS = [0x8e3a1f, 0x2f5d99, 0x6f7c35, 0xc98f2e, 0x5a3a22, 0x7a2f4a, 0xd9c7a0];

/** default camera: polar angle, azimuth, distance */
const CAM: [number, number, number] = [0.93, 0.24, 320];

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
    const sky = new THREE.Color(this.season === 'winter' ? 0xdfe7ee : 0xe8cf9f);
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
    this.scene.add(buildScenery());

    const ringGeo = new THREE.RingGeometry(0.86, 1, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.visible = false;
    this.ring.renderOrder = 2;
    this.scene.add(this.ring);

    this.initLeaves();
    this.setNight(!!opts.night);

    const controls = new OrbitControls(this.camera, renderer.domElement);
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
    this.updateLabels(b, constructing);
  }

  /** Moonlight, lit windows and lantern-carrying villagers. */
  setNight(n: boolean): void {
    this.night = n;
    const winter = this.season === 'winter';
    const sky = new THREE.Color(n ? (winter ? 0x1c2638 : 0x1a1d2e) : winter ? 0xdfe7ee : 0xe8cf9f);
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
      this.sun.color.set(winter ? 0xfff2e0 : 0xffd29a);
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
    const scale = OUTSIDE.includes(id) ? 1.25 : 1.4;
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
    const loops: THREE.Vector3[][] = [
      circlePath(0, 8, 7.5, 16),
      circlePath(0, 0, 31, 40),
      [[0, 38], [0, 16], [-9, 14], [-20, 11], [-9, 14], [0, 16]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
      [[0, 16], [11, 13], [18, 26], [11, 13]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
      [[0, 38], [0, 60], [-20, 42], [-40, 44], [-20, 42], [0, 60]].map(([x, z]) => new THREE.Vector3(x, heightAt(x, z), z)),
    ];
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
    const want: TroopModel[] = [];
    for (const k of TROOP_KINDS) {
      const n = units[k] ?? 0;
      if (n > 0) want.push(k);
      if (n >= 100 && !['paladin', 'sorcerer', 'druid', 'goblin', 'noble'].includes(k)) want.push(k);
    }
    const key = want.join(',');
    if (key === this.troopKey) return;
    this.troopKey = key;
    for (const t of this.troops) {
      this.scene.remove(t.g);
      disposeTree(t.g);
    }
    this.troops = [];
    const foot: THREE.Vector3[][] = [
      circlePath(0, 8, 9.5, 18),
      [[0, 36], [0, 16], [-10, 12], [-20, 10], [-10, 12], [0, 16]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
      [[0, 16], [12, 12], [19, 24], [12, 12]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
      circlePath(0, 0, 28, 36),
    ];
    const ride: THREE.Vector3[][] = [
      circlePath(0, 0, 34, 44).map((p) => new THREE.Vector3(p.x, heightAt(p.x, p.z), p.z)),
      [[0, 40], [0, 62], [-22, 44], [-42, 46], [-22, 44], [0, 62]].map(([x, z]) => new THREE.Vector3(x, heightAt(x, z), z)),
    ];
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

  // ---------- leaves ----------

  private initLeaves(): void {
    const snow = this.season === 'winter';
    const n = snow ? 420 : 140;
    const geo = snow ? new THREE.IcosahedronGeometry(0.16, 0) : new THREE.PlaneGeometry(0.55, 0.38);
    const m = snow ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    this.leaves = new THREE.InstancedMesh(geo, m, n);
    this.leaves.castShadow = false;
    const cols = snow ? [0xffffff, 0xf2f6fb, 0xe6eef7] : [C.leafOrange, C.leafRed, C.leafYellow, C.leafGold];
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

function circlePath(cx: number, cz: number, r: number, n: number): THREE.Vector3[] {
  return Array.from({ length: n }, (_, i) => new THREE.Vector3(cx + Math.cos((i / n) * Math.PI * 2) * r, 0, cz + Math.sin((i / n) * Math.PI * 2) * r));
}

function pathLength(p: THREE.Vector3[]): number {
  let l = 0;
  for (let i = 0; i < p.length; i++) l += p[i].distanceTo(p[(i + 1) % p.length]);
  return l;
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
