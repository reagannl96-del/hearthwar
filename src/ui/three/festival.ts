// The winter festival: when a snowed-in village is in high spirits, a great fir
// goes up in the square by the market, hung with strings of coloured lights and
// crowned with a golden star. Presents pile up under its branches and the
// villagers gather round it: singing, cheering, bringing gifts, while the
// children skip in a ring between them.
//
// Everything that stands still is baked into a few meshes. The lights share a
// handful of materials (one per colour and twinkle phase), so the renderer can
// make the whole tree twinkle by nudging a few numbers each frame.

import * as THREE from 'three';
import { bake, blob, box, cone, cyl, disposeTree, getTheme, mesh, rng } from './kit';
import { person } from './props';

/** How far out the gathering reaches from the tree's foot (adults stand at RING_ADULT). */
const TREE_SCALE = 1.1;
const RING_ADULT = 3.35, RING_CHILD = 2.85;
/** Ground the whole festival takes up (its radius), for the layout. */
export const FESTIVAL_R = RING_ADULT + 0.4;

// the tree's tiers (before scaling): where each starts, its radius at the bottom, its height
const TIERS: [number, number, number][] = [
  [0.75, 1.85, 2.6],
  [2.0, 1.5, 2.3],
  [3.15, 1.12, 2.0],
  [4.2, 0.78, 1.75],
];
const TOP = TIERS[TIERS.length - 1][0] + TIERS[TIERS.length - 1][2];

/** How far the outermost branches reach at this height (0 above the tip). */
function reach(y: number): number {
  let r = 0;
  for (const [y0, r0, h] of TIERS) if (y >= y0 && y <= y0 + h) r = Math.max(r, r0 * (1 - (y - y0) / h));
  return r;
}

// colours no season or hero theme repaints
const NEEDLES = [0x2a6a3a, 0x2f7440, 0x276236, 0x2d6d3c];
const SNOW = 0xf6f9fc, SNOW_SHADE = 0xe3ebf2;
const BARK = 0x553621;
const GOLD = 0xf2c24a;
const BULBS = [0xff4a3a, 0xffc53a, 0x56e86a, 0x4a8cff, 0xfff1d6];
const PHASES = 3;
const TUNICS = [0xa8322b, 0x2e6b45, 0x3a5fa8, 0xc9862e, 0x7a3a6a, 0x8a5a36, 0xd8c7a3, 0x5a7a9a];
const WRAPS: [number, number][] = [
  [0xc0302a, 0xf2d27a], [0x2f7a45, 0xe8453a], [0x3656a8, 0xf4f1e6], [0xeee3c4, 0xc0302a],
  [0x7a3a8a, 0xf2c24a], [0xd8a030, 0x2f7a45], [0xe8453a, 0xf4f1e6], [0x2a8a8a, 0xf2c24a],
];

type Pose = 'gift' | 'cheer' | 'sing' | 'link' | 'child';

interface Dancer {
  g: THREE.Object3D;
  pose: Pose;
  arms: THREE.Object3D[];
  ph: number;
  /** children skip round the tree: their angle and distance */
  a: number;
  r: number;
  s: number;
}

interface Bulb {
  m: THREE.MeshLambertMaterial;
  ph: number;
  speed: number;
}

interface FestState {
  dancers: Dancer[];
  bulbs: Bulb[];
  star: THREE.MeshLambertMaterial;
}

/** A wrapped present: paper, a ribbon both ways round and a bow on top. */
function present(w: number, h: number, d: number, paper: number, ribbon: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, h, d, paper));
  g.add(box(w + 0.02, h + 0.02, Math.min(0.09, d * 0.22), ribbon, 0, -0.01, 0));
  g.add(box(Math.min(0.09, w * 0.22), h + 0.02, d + 0.02, ribbon, 0, -0.01, 0));
  for (const s of [-1, 1]) {
    const loop = blob(0.08, ribbon, s * 0.07, h + 0.05, 0, 1.1, 0.7, 0.55);
    loop.rotation.z = s * 0.5;
    g.add(loop);
  }
  g.add(blob(0.04, ribbon, 0, h + 0.03, 0));
  return g;
}

/** An arm hung from the shoulder: rotate it about z to lift it sideways, about x to reach forward. */
function arm(tunic: number, side: number, scaleY = 1): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(side * 0.25, 0.98 * scaleY, 0);
  const sleeve = box(0.1, 0.5, 0.1, tunic, 0, -0.5, 0);
  pivot.add(sleeve);
  pivot.add(blob(0.065, 0xe0b48a, 0, -0.52, 0));
  return pivot;
}

/** The fir: tiers of needles laden with snow, a trunk, baubles and a golden star; its lights are added separately. */
function fir(r: () => number, starMat: THREE.MeshLambertMaterial): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.28, 0.36, 1.0, BARK, 7));
  TIERS.forEach(([y0, r0, h], i) => {
    const t = cone(r0, h, NEEDLES[i % NEEDLES.length], 10, 0, y0);
    t.rotation.y = i * 0.31;
    g.add(t);
    // snow lying on the shoulders of the tier, just under the one above
    const f0 = i < TIERS.length - 1 ? 0.37 : 0.64, f1 = i < TIERS.length - 1 ? 0.52 : 1;
    const band = new THREE.CylinderGeometry(r0 * (1 - f1) * 1.05 + 0.01, r0 * (1 - f0) * 1.05, h * (f1 - f0), 10);
    band.translate(0, y0 + h * (f0 + f1) / 2, 0);
    const snow = mesh(band, SNOW);
    snow.rotation.y = i * 0.31;
    g.add(snow);
    // lumps of snow caught on the branch tips round the hem
    const n = 7 + i;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.4 + i;
      const rr = r0 * 0.92;
      g.add(blob(0.16 + r() * 0.06, k % 3 ? SNOW : SNOW_SHADE, Math.cos(a) * rr, y0 + 0.14, Math.sin(a) * rr, 1.4, 0.5, 1.4));
    }
    // baubles
    const nb = 5 - Math.min(3, i);
    for (let k = 0; k < nb; k++) {
      const yy = y0 + h * (0.1 + r() * 0.3);
      const a = r() * Math.PI * 2;
      const rr = reach(yy) + 0.06;
      g.add(blob(0.12, [0xc0302a, GOLD, 0x3656a8, 0xd8d8e0][(k + i) % 4], Math.cos(a) * rr, yy - 0.12, Math.sin(a) * rr, 1, 1, 1, 1));
    }
  });
  // the star: five points, a little proud of the tip
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + (k / 10) * Math.PI * 2;
    const rr = k % 2 ? 0.2 : 0.5;
    pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
  }
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
  geo.translate(0, 0, -0.08);
  const star = new THREE.Mesh(geo, starMat);
  star.position.y = TOP + 0.35;
  star.rotation.y = 0.24;
  g.add(star);
  g.scale.setScalar(TREE_SCALE);
  return g;
}

/** The strings of lights: beads spiralling down the tree, sharing a material per colour and twinkle phase. */
function lights(bulbs: Bulb[]): THREE.Group {
  const g = new THREE.Group();
  const mats: THREE.MeshLambertMaterial[][] = BULBS.map((c, ci) =>
    Array.from({ length: PHASES }, (_, p) => {
      const m = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, flatShading: true });
      bulbs.push({ m, ph: p * 2.1 + ci * 0.9, speed: 1.6 + ((ci * 3 + p) % 4) * 0.45 });
      return m;
    }),
  );
  const bead = new THREE.IcosahedronGeometry(0.075, 0);
  // two strings, wound round the tree half a turn apart
  let n = 0;
  for (let s = 0; s < 2; s++) {
    const turns = 4.2;
    for (let u = 0.03; u < 0.97; u += 0.0105) {
      const y = 0.95 + u * (TOP - 1.15);
      const a = u * turns * Math.PI * 2 + s * Math.PI;
      // the string sags a little between the tiers, riding just outside the needles
      const rr = reach(y) + 0.05;
      if (rr < 0.12) continue;
      const m = new THREE.Mesh(bead, mats[n % BULBS.length][(n * 7 + s) % PHASES]);
      m.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
      g.add(m);
      n++;
    }
  }
  g.scale.setScalar(TREE_SCALE);
  return g;
}

/**
 * The whole festival, centred on the tree's foot. Villagers are kept separate
 * (userData.dynamic) so they can move; call stepFestival every frame.
 */
export function buildFestival(): THREE.Group {
  const r = rng(1225);
  const state: FestState = {
    dancers: [],
    bulbs: [],
    star: new THREE.MeshLambertMaterial({ color: GOLD, emissive: 0xffb42a, emissiveIntensity: 0.5, flatShading: true }),
  };
  const root = new THREE.Group();
  // a ring of trodden snow round the tree
  const pad = cyl(FESTIVAL_R - 0.1, FESTIVAL_R, 0.06, SNOW_SHADE, 20, 0, -0.02);
  root.add(pad);
  root.add(cyl(1.0, 1.05, 0.08, 0xb3332a, 12, 0, 0)); // a red skirt round the trunk
  root.add(fir(r, state.star));
  root.add(lights(state.bulbs));

  // presents under the branches
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + r() * 0.3;
    const d = 1.7 + r() * 0.55;
    const w = 0.34 + r() * 0.34, h = 0.26 + r() * 0.3, dd = 0.3 + r() * 0.3;
    const [paper, ribbon] = WRAPS[i % WRAPS.length];
    const p = present(w, h, dd, paper, ribbon);
    p.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    p.rotation.y = r() * Math.PI;
    root.add(p);
    // now and then a little one stacked on top
    if (i % 4 === 1) {
      const [p2, r2] = WRAPS[(i + 3) % WRAPS.length];
      const q = present(w * 0.6, h * 0.7, dd * 0.6, p2, r2);
      q.position.set(Math.cos(a) * d, h + 0.02, Math.sin(a) * d);
      q.rotation.y = r() * Math.PI;
      root.add(q);
    }
  }

  // the grown-ups, in a ring facing the tree
  const poses: Pose[] = ['gift', 'sing', 'cheer', 'link', 'gift', 'sing', 'link', 'cheer', 'sing'];
  poses.forEach((pose, i) => {
    const a = (i / poses.length) * Math.PI * 2 + 0.2;
    const tunic = TUNICS[i % TUNICS.length];
    const g = person(tunic);
    const arms = [arm(tunic, -1), arm(tunic, 1)];
    g.add(...arms);
    if (pose === 'gift') {
      const [paper, ribbon] = WRAPS[(i * 3) % WRAPS.length];
      const p = present(0.36, 0.3, 0.3, paper, ribbon);
      p.position.set(0, 0.6, 0.42);
      g.add(p);
      for (const [k, am] of arms.entries()) { am.rotation.x = -1.15; am.rotation.z = (k ? 1 : -1) * -0.25; }
    }
    g.scale.setScalar(1.3);
    const x = Math.cos(a) * RING_ADULT, z = Math.sin(a) * RING_ADULT;
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(-x, -z);
    g.userData.dynamic = true;
    root.add(g);
    state.dancers.push({ g, pose, arms, ph: r() * 6, a, r: RING_ADULT, s: 1.3 });
  });

  // the children skip round between the presents and the grown-ups
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6;
    const tunic = TUNICS[(i * 3 + 2) % TUNICS.length];
    const g = person(tunic);
    const arms = [arm(tunic, -1), arm(tunic, 1)];
    g.add(...arms);
    // a woolly hat with a bobble (hero folk keep their own hoods and hats)
    if (getTheme() === 'classic') {
      g.add(cyl(0.21, 0.21, 0.14, [0xc0302a, 0x3656a8, 0x2f7a45, 0xd8a030][i], 7, 0, 1.3));
      g.add(blob(0.08, SNOW, 0, 1.5, 0));
    }
    g.scale.setScalar(0.85);
    g.userData.dynamic = true;
    root.add(g);
    state.dancers.push({ g, pose: 'child', arms, ph: i * 1.7, a, r: RING_CHILD, s: 0.85 });
  }

  const out = bake(root);
  out.userData.festival = state;
  return out;
}

/** The villagers at the festival (hidden while a battle is on). */
export function festivalPeople(g: THREE.Group): THREE.Object3D[] {
  return (g.userData.festival as FestState).dancers.map((d) => d.g);
}

/**
 * One frame of the festival: the lights twinkle (livelier and brighter at night,
 * when the bloom picks them up), the star pulses, and the villagers sing, cheer
 * and skip round the tree.
 */
export function stepFestival(g: THREE.Group, dt: number, t: number, night: boolean): void {
  const st = g.userData.festival as FestState;
  const base = night ? 0.75 : 0.45, amp = night ? 0.75 : 0.45, pace = night ? 1.35 : 1;
  for (const b of st.bulbs) {
    const w = Math.sin(t * b.speed * pace + b.ph);
    // mostly lit, dipping now and then, with a quick sparkle at the top of each swing
    b.m.emissiveIntensity = base + amp * (0.5 + 0.5 * w) + (w > 0.93 ? amp * 0.6 : 0);
  }
  st.star.emissiveIntensity = (night ? 0.95 : 0.55) + Math.sin(t * 1.7) * (night ? 0.2 : 0.12);
  for (const d of st.dancers) {
    const { g: p, arms, ph } = d;
    switch (d.pose) {
      case 'gift':
        // offering the present, bobbing on their toes
        p.position.y = Math.abs(Math.sin(t * 2.2 + ph)) * 0.06;
        p.rotation.z = Math.sin(t * 1.1 + ph) * 0.04;
        break;
      case 'cheer':
        // arms up, waving
        arms[0].rotation.z = -(2.55 + Math.sin(t * 5 + ph) * 0.3);
        arms[1].rotation.z = 2.55 + Math.sin(t * 5 + ph + 1.3) * 0.3;
        p.position.y = Math.max(0, Math.sin(t * 3.4 + ph)) * 0.12;
        break;
      case 'sing':
        // swaying side to side in time
        p.rotation.z = Math.sin(t * 1.6 + ph) * 0.09;
        arms[0].rotation.z = -0.2 - Math.sin(t * 1.6 + ph) * 0.1;
        arms[1].rotation.z = 0.2 - Math.sin(t * 1.6 + ph) * 0.1;
        break;
      case 'link':
        // arms out to the sides as if arm in arm with the neighbours, rocking
        arms[0].rotation.z = -1.0 - Math.sin(t * 1.6 + ph) * 0.12;
        arms[1].rotation.z = 1.0 - Math.sin(t * 1.6 + ph) * 0.12;
        p.rotation.z = Math.sin(t * 1.6 + ph) * 0.06;
        break;
      case 'child': {
        // skipping round the tree, hands up
        d.a += dt * 0.32;
        const x = Math.cos(d.a) * d.r, z = Math.sin(d.a) * d.r;
        p.position.set(x, Math.abs(Math.sin(t * 5.5 + ph)) * 0.2, z);
        // face the way they skip, turned a little in towards the tree
        p.rotation.y = Math.atan2(-Math.sin(d.a), Math.cos(d.a)) - 0.45;
        arms[0].rotation.z = -(2.2 + Math.sin(t * 5.5 + ph) * 0.35);
        arms[1].rotation.z = 2.2 + Math.sin(t * 5.5 + ph + Math.PI) * 0.35;
        break;
      }
    }
  }
}

/** Take the festival down: its geometry and its own light materials. */
export function disposeFestival(g: THREE.Group): void {
  const st = g.userData.festival as FestState | undefined;
  disposeTree(g);
  if (!st) return;
  for (const b of st.bulbs) b.m.dispose();
  st.star.dispose();
}
