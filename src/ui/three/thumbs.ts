// Renders small pictures of building models (for building screens), cached by tier.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import { buildModel, visualTier } from './buildings';
import { disposeTree, getSeason } from './kit';
import { buildWall } from './scene';

let renderer: THREE.WebGLRenderer | null = null;
let failed = false;
const cache = new Map<string, string>();

function getRenderer(): THREE.WebGLRenderer | null {
  if (renderer || failed) return renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setSize(300, 225, false);
    renderer.setPixelRatio(1.5);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
  } catch {
    failed = true;
  }
  return renderer;
}

export function buildingThumb(id: BuildingId, level: number): string | null {
  const key = `${id}|${visualTier(id, Math.max(1, level))}|${getSeason()}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = getRenderer();
  if (!r) return null;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(getSeason() === 'winter' ? 0xdfe7ee : 0xe8cf9f);
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x5b4a2e, 1.4));
  const sun = new THREE.DirectionalLight(0xffd29a, 2.4);
  sun.position.set(-30, 50, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 24), new THREE.MeshLambertMaterial({ color: getSeason() === 'winter' ? 0xe8eef2 : 0x8f9447 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  let obj: THREE.Object3D;
  let span: number;
  if (id === 'wall') {
    const wall = buildWall(Math.max(1, level), 0xe0a526);
    wall.position.set(0, 0, -40);
    obj = wall;
    span = 26;
  } else {
    const b = buildModel(id, Math.max(1, level), 0xe0a526);
    obj = b.obj;
    span = Math.max(b.w, b.d, b.h * 0.9) * 1.25 + 4;
  }
  scene.add(obj);
  const cam = new THREE.OrthographicCamera(-span * 0.67, span * 0.67, span * 0.5, -span * 0.5, 1, 400);
  cam.position.set(span * 1.2, span * 1.35, span * 2.2);
  cam.lookAt(0, id === 'wall' ? 2 : span * 0.18, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  disposeTree(scene);
  cache.set(key, url);
  return url;
}
