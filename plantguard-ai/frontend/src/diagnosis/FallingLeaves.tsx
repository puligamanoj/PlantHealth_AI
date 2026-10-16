import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildWholeLeaf } from './leafGeometry';
import { mulberry32 } from './easing';

const PALETTE = {
  neutral: ['#7fb069', '#a9c46c', '#d9c36a', '#5fa777'],  // soft greens + yellows (healthy / pending)
  diseased: ['#6b4a33', '#8a3b2e', '#a3641f', '#4a3a33'], // muted browns + reds
};
const CAM_Z = 7;

/**
 * One InstancedMesh (single draw call). Every leaf has its own depth, fall speed, wind drift and tumble.
 * Depth cue = size + scene fog (distant leaves haze into the background). A true camera depth-of-field pass is NOT
 * used (it would need postprocessing and costs fill-rate on mobile).
 */
export default function FallingLeaves({ diseased, count }: { diseased: boolean; count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { viewport } = useThree();
  const geo = useMemo(() => buildWholeLeaf(10, 6), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, metalness: 0, flatShading: false }), []);
  const P = useMemo(() => {
    const r = mulberry32(21);
    return Array.from({ length: count }, () => {
      const z = -6 + r() * 8; // far (-6) .. near (+2)
      return { z, x: r() * 2.2 - 1.1, off: r(), speed: 0.25 + r() * 0.35, drift: (r() - 0.5) * 0.35, ph: r() * 6.28, rs: 0.3 + r() * 0.9, size: (0.07 + r() * 0.1) * (1 + (z + 6) * 0.05) };
    });
  }, [count]);
  const cur = useMemo(() => P.map(() => new THREE.Color('#7fb069')), [P]);
  const tgt = useMemo(() => new THREE.Color(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pick = useMemo(() => P.map((_, i) => i % 4), [P]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useEffect(() => { const m = mesh.current; if (!m) return; cur.forEach((c, i) => m.setColorAt(i, c)); }, [cur]);

  useFrame(({ clock }, dt) => {
    const m = mesh.current; if (!m) return;
    const t = clock.elapsedTime, pal = diseased ? PALETTE.diseased : PALETTE.neutral;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], f = (CAM_Z - p.z) / CAM_Z; // perspective factor: visible half-extent at this depth
      const hw = (viewport.width / 2) * f, hh = (viewport.height / 2) * f + 1, range = hh * 2;
      const y = hh - (((t * p.speed + p.off * range) % range) + range) % range;
      const x = p.x * hw + Math.sin(t * 0.5 + p.ph) * 0.45 + p.drift * ((y + hh) * 0.5); // sway + wind drift
      dummy.position.set(x, y, p.z);
      dummy.rotation.set(Math.sin(t * p.rs + p.ph) * 1.1, t * p.rs * 0.6 + p.ph, Math.cos(t * p.rs * 0.8 + p.ph) * 0.9);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
      tgt.set(pal[pick[i]]); cur[i].lerp(tgt, Math.min(1, dt * 1.2)); m.setColorAt(i, cur[i]); // smooth recolour on outcome
    }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} />;
}
