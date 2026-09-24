// The ruler's banners at the gate: once a village's wall reaches level 20, two
// tall poles stand either side of the road just outside the gate towers, each
// flying the owner's own banner (painted by flagArt, so the cloth matches the
// banner editor exactly). The cloth is a subdivided plane, cut to the banner's
// shape by the texture's transparency, rippling in the wind.

import * as THREE from 'three';
import type { FlagDesign } from '../../engine/data/flags';
import { drawFlag } from '../flagArt';
import { C, blob, box, cone, cyl, type Theme } from './kit';
import { heightAt } from './scene';

/** The wall level a village needs before its gate flies the ruler's banner. */
export const BANNER_WALL = 20;

/**
 * Where the poles stand: in front of the outer halves of the gate towers (at
 * x ±5.3, z 43.7, 2.7 across plus their roofs), clear of the road and of what
 * each realm lines it with (lamps, banners and the druids' arches at x ±3.9,
 * the skull gate at ±4.6), and inside the riders' ring (r 52).
 */
export const BANNER_POLES: [number, number][] = [[-7.6, 49.4], [7.6, 49.4]];
/** Pole height, and the cloth's size (it flies away from the road on each side). */
export const POLE_H = 13.2;
export const CLOTH_W = 4.5;
export const CLOTH_H = 3.0;

const TEX_W = 384, TEX_H = 256;
const SEG_X = 18, SEG_Y = 6;

/** Each realm's poles: plain timber, the Order's white and gold, violet ebony, living wood, lashed scrap, black iron. */
type PoleLook = { pole: number; band: number };
const POLE: Partial<Record<Theme, PoleLook>> & { classic: PoleLook } = {
  classic: { pole: 0x5a3a22, band: 0x8a6038 },
  paladin: { pole: 0xece6d8, band: 0xe0a526 },
  sorcerer: { pole: 0x3a2a5a, band: 0x8fb8ff },
  druid: { pole: 0x6a4a2a, band: 0x5e7d32 },
  goblin: { pole: 0x6e4a2a, band: 0x5f3218 },
  necromancer: { pole: 0x2e2a33, band: 0xe6dfcc },
};

interface Cloth { mesh: THREE.Mesh; base: Float32Array; phase: number }

function flagTexture(design: FlagDesign): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  drawFlag(c.getContext('2d')!, design, TEX_W, TEX_H, { plain: true });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function cloth(tex: THREE.Texture, phase: number): Cloth {
  const geo = new THREE.PlaneGeometry(CLOTH_W, CLOTH_H, SEG_X, SEG_Y);
  geo.translate(CLOTH_W / 2, -CLOTH_H / 2, 0); // the hoist runs down the pole from the top corner
  const material = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, alphaTest: 0.5 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // the shadow keeps the banner's shape too (a swallowtail's notch, a pennant's point)
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  mesh.userData.banner = true;
  return { mesh, base: Float32Array.from(geo.attributes.position.array as ArrayLike<number>), phase };
}

function pole(theme: Theme): THREE.Group {
  const p = POLE[theme] ?? POLE.classic;
  const g = new THREE.Group();
  g.add(box(0.9, 0.45, 0.9, C.stone));
  g.add(box(0.6, 0.25, 0.6, C.stoneDark, 0, 0.45, 0));
  g.add(cyl(0.1, 0.13, POLE_H, p.pole, 8, 0, 0.5, 0));
  for (const y of [1.6, POLE_H - 3.3]) g.add(cyl(0.15, 0.15, 0.16, p.band, 8, 0, y, 0));
  // the gold finial: a collar, a ball and a spike
  g.add(cyl(0.17, 0.14, 0.18, 0xe9b83a, 8, 0, POLE_H + 0.42, 0));
  g.add(blob(0.24, 0xe9b83a, 0, POLE_H + 0.8, 0, 1, 1, 1, 1));
  g.add(cone(0.1, 0.5, 0xf6d36a, 6, 0, POLE_H + 0.98, 0));
  return g;
}

/** Both poles and their banners, ready to add to the scene. */
export function buildGateBanners(design: FlagDesign, theme: Theme): THREE.Group {
  const g = new THREE.Group();
  g.name = 'gate-banners';
  const tex = flagTexture(design);
  const cloths: Cloth[] = [];
  BANNER_POLES.forEach(([x, z], i) => {
    const side = Math.sign(x) || 1;
    const p = pole(theme);
    p.position.set(x, heightAt(x, z), z);
    // each banner flies away from the road; on the left you see its reverse, as on a real pole
    const c = cloth(tex, i * 1.7);
    c.mesh.position.set(0.12 * side, POLE_H + 0.3, 0);
    c.mesh.rotation.y = side > 0 ? 0 : Math.PI;
    p.add(c.mesh);
    cloths.push(c);
    g.add(p);
  });
  g.userData.cloths = cloths;
  g.userData.texture = tex;
  return g;
}

/** Ripple the cloth: a travelling wave that grows toward the fly, and a little droop. */
export function waveBanners(g: THREE.Group, t: number): void {
  for (const c of g.userData.cloths as Cloth[]) {
    const pos = c.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const a = pos.array as Float32Array;
    for (let i = 0; i < a.length; i += 3) {
      const x = c.base[i], y = c.base[i + 1];
      const k = x / CLOTH_W;
      const amp = 0.34 * k ** 1.15;
      const ph = x * 1.7 - t * 3.1 + c.phase;
      a[i] = x - amp * 0.35 * (1 - Math.cos(ph)) * 0.5;
      a[i + 1] = y - 0.14 * k * k + Math.sin(ph * 0.5 + y) * 0.03 * k;
      a[i + 2] = Math.sin(ph) * amp + Math.sin(x * 3.3 - t * 4.7 + y * 0.9 + c.phase) * amp * 0.22;
    }
    pos.needsUpdate = true;
    c.mesh.geometry.computeVertexNormals();
  }
}

export function disposeBanners(g: THREE.Group): void {
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    if (o.userData.banner) {
      (o.material as THREE.Material).dispose();
      o.customDepthMaterial?.dispose();
    }
  });
  (g.userData.texture as THREE.Texture | undefined)?.dispose();
}
