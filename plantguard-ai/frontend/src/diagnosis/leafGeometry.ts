import * as THREE from 'three';
import { mulberry32 } from './easing';

/**
 * ONE parametric leaf surface P(t,u): t = base(0) -> tip(1) (t<0 is the petiole), u = -1..1 across the blade.
 * The 8 assembly fragments are sub-grids of this same function, so their borders coincide exactly and the
 * assembled leaf has no cracks. Normals come from finite differences of P, so shading is continuous across seams.
 */
export const Y_MIN = -1.87; // must match YMIN/YMAX in shaders.ts
export const Y_MAX = 1.87;
const LEN = 3.4;
const SHIFT = 0.17;

const width = (t: number) => {
  const tc = Math.min(1, Math.max(0, t));
  const w = 0.97 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(tc, 0.75))), 0.9);
  return t < 0.02 ? Math.max(w, 0.03) : w; // thin petiole ribbon below the blade
};

export function leafPoint(t: number, u: number, out = new THREE.Vector3()) {
  const tc = Math.min(1, Math.max(0, t));
  const s = Math.sin(Math.PI * tc);
  const x = u * width(t);
  const y = (t - 0.5) * LEN + SHIFT;
  // dome across the blade + soft wavy margin + drooping tip
  const z = 0.12 * s * (1 - 1.6 * u * u) + 0.035 * Math.sin(tc * 16 + u * 2.4) * Math.abs(u) * s - 0.28 * tc * tc * tc;
  return out.set(x, y, z);
}

export function buildLeafRegion(t0: number, t1: number, u0: number, u1: number, rows: number, cols: number) {
  const nv = (rows + 1) * (cols + 1);
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), aLeaf = new Float32Array(nv * 2);
  const p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
  const e = 0.004;
  let k = 0;
  for (let i = 0; i <= rows; i++) {
    const t = t0 + ((t1 - t0) * i) / rows;
    for (let j = 0; j <= cols; j++, k++) {
      const u = u0 + ((u1 - u0) * j) / cols;
      leafPoint(t, u, p);
      pos.set([p.x, p.y, p.z], k * 3);
      leafPoint(t + e, u, a); leafPoint(t - e, u, b); leafPoint(t, u + e, c); leafPoint(t, u - e, d);
      n.crossVectors(c.sub(d), a.sub(b)); // dP/du x dP/dt  -> +z side of the blade
      if (n.lengthSq() < 1e-12) n.set(0, 0, 1); else n.normalize();
      nor.set([n.x, n.y, n.z], k * 3);
      aLeaf.set([u, t], k * 2);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const v = i * (cols + 1) + j, w = v + cols + 1;
    idx.push(v, v + 1, w, w, v + 1, w + 1); // counter-clockwise seen from +z
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aLeaf', new THREE.BufferAttribute(aLeaf, 2));
  g.setIndex(idx);
  return g;
}

/** The 8 fragments and the screen edge/corner each one flies in from (dx,dy in -1..1). */
export const FRAGMENTS = [
  { id: 'tip', t: [0.78, 1], u: [-1, 1], from: [0, 1] },          // top-center
  { id: 'upper-left', t: [0.5, 0.78], u: [-1, 0], from: [-1, 1] }, // top-left
  { id: 'upper-right', t: [0.5, 0.78], u: [0, 1], from: [1, 1] },  // top-right
  { id: 'mid-left', t: [0.25, 0.5], u: [-1, 0], from: [-1, 0] },   // middle-left
  { id: 'mid-right', t: [0.25, 0.5], u: [0, 1], from: [1, 0] },    // middle-right
  { id: 'lower-left', t: [0.08, 0.25], u: [-1, 0], from: [-1, -1] }, // bottom-left
  { id: 'lower-right', t: [0.08, 0.25], u: [0, 1], from: [1, -1] },  // bottom-right
  { id: 'base', t: [-0.1, 0.08], u: [-1, 1], from: [0, -1] },      // bottom-center (petiole)
] as const;

export const buildFragmentGeometry = (f: (typeof FRAGMENTS)[number]) =>
  buildLeafRegion(f.t[0], f.t[1], f.u[0], f.u[1], Math.max(4, Math.round((f.t[1] - f.t[0]) * 70)), Math.max(6, Math.round((f.u[1] - f.u[0]) * 14)));

export const buildWholeLeaf = (rows = 12, cols = 8) => buildLeafRegion(-0.1, 1, -1, 1, rows, cols);

/** Random points on the blade (leaf space) for spores / burst particles. */
export function sampleLeafPoints(count: number, seed = 5) {
  const r = mulberry32(seed), out = new Float32Array(count * 3), v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    leafPoint(0.06 + r() * 0.9, (r() * 2 - 1) * 0.9, v);
    out.set([v.x, v.y, v.z], i * 3);
  }
  return out;
}
