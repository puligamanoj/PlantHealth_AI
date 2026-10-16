import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FRAGMENTS, buildFragmentGeometry, sampleLeafPoints } from './leafGeometry';
import { BURST_VERT, GLASS, LEAF_FRAG, LEAF_VERT, PALETTES, POINT_FRAG, SPORE_VERT } from './shaders';
import { clamp01, easeInOutCubic, easeInOutSine, easeOutBack, easeOutCubic, mulberry32 } from './easing';

export type Outcome = 'pending' | 'healthy' | 'diseased';
export type Phase = 'assemble' | 'hollow' | 'fill' | 'ready' | 'dissolve' | 'done';
interface Props { outcome: Outcome; dismiss: boolean; reduce: boolean; onPhase: (p: Phase) => void }

// Per-fragment stagger so the 8 pieces land at slightly different moments (still "simultaneous" flights).
const DELAYS = [0, 0.14, 0.07, 0.2, 0.11, 0.24, 0.16, 0.05];

/**
 * Timeline (a tiny state machine driven from useFrame):
 *  assemble -> 8 fragments fly from the 8 screen edges/corners and dock (back-out ease = spring settle)
 *  hollow   -> glass membrane + glowing veins. WAITS here while the API call is pending (loading state)
 *  fill     -> starts only once the real outcome is known; shader fill front sweeps tip -> base, spores rise/drift
 *  ready    -> interactive (pointer tilt, breathing); a click/tap sets `dismiss`
 *  dissolve -> noise-threshold dissolve + shrink + particle burst, then 'done' reveals the result panel
 */
export default function Leaf({ outcome, dismiss, reduce, onPhase }: Props) {
  const group = useRef<THREE.Group>(null);
  const frags = useRef<(THREE.Group | null)[]>([]);
  const outcomeRef = useRef(outcome); const dismissRef = useRef(dismiss);
  useEffect(() => { outcomeRef.current = outcome; }, [outcome]);
  useEffect(() => { dismissRef.current = dismiss; }, [dismiss]);

  const geos = useMemo(() => FRAGMENTS.map(buildFragmentGeometry), []);
  const u = useMemo(() => ({
    uTime: { value: 0 }, uFill: { value: 0 }, uDissolve: { value: 0 }, uAppear: { value: 0 }, uGlow: { value: 1 }, uIri: { value: 0 },
    uColA: { value: new THREE.Color(PALETTES.healthy.A) }, uColB: { value: new THREE.Color(PALETTES.healthy.B) }, uColC: { value: new THREE.Color(PALETTES.healthy.C) },
    uVein: { value: new THREE.Color(PALETTES.healthy.vein) }, uAccent: { value: new THREE.Color(PALETTES.healthy.accent) }, uGlass: { value: new THREE.Color(GLASS) },
  }), []);
  const material = useMemo(() => new THREE.ShaderMaterial({ uniforms: u, vertexShader: LEAF_VERT, fragmentShader: LEAF_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide }), [u]);
  const variation = useMemo(() => { const r = mulberry32(11); return FRAGMENTS.map(() => ({ rot: new THREE.Vector3((r() - 0.5) * 5, (r() - 0.5) * 5, (r() - 0.5) * 6), z: (r() - 0.5) * 2.5, s0: 0.6 + r() * 0.6, dur: 1.6 + r() * 0.5 })); }, []);
  useEffect(() => () => { geos.forEach((g) => g.dispose()); material.dispose(); }, [geos, material]);

  // spores + burst share uniforms with the leaf so the fill front and particles stay in sync
  const sporeU = useMemo(() => ({ uTime: u.uTime, uFill: u.uFill, uSize: { value: 7 }, uPx: { value: 1 }, uAlpha: { value: 0 }, uDir: { value: 1 }, uSpread: { value: 1 }, uColor: { value: new THREE.Color() } }), [u]);
  const burstU = useMemo(() => ({ uT: { value: 0 }, uSize: { value: 9 }, uPx: { value: 1 }, uColor: { value: new THREE.Color() } }), []);
  const sporeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry(), n = 240, r = mulberry32(3), seed = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) seed[i] = r();
    g.setAttribute('position', new THREE.BufferAttribute(sampleLeafPoints(n, 5), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    return g;
  }, []);
  const burstGeo = useMemo(() => {
    const g = new THREE.BufferGeometry(), n = 220, r = mulberry32(9), vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = r() * 6.283, s = 0.4 + r() * 1.2; vel.set([Math.cos(a) * s, Math.sin(a) * s * 0.8, (r() - 0.4) * s], i * 3); }
    g.setAttribute('position', new THREE.BufferAttribute(sampleLeafPoints(n, 8), 3)); g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    return g;
  }, []);
  const sporeMat = useMemo(() => new THREE.ShaderMaterial({ uniforms: sporeU, vertexShader: SPORE_VERT, fragmentShader: POINT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), [sporeU]);
  const burstMat = useMemo(() => new THREE.ShaderMaterial({ uniforms: burstU, vertexShader: BURST_VERT, fragmentShader: POINT_FRAG, transparent: true, depthWrite: false }), [burstU]);
  useEffect(() => () => { sporeGeo.dispose(); burstGeo.dispose(); sporeMat.dispose(); burstMat.dispose(); }, [sporeGeo, burstGeo, sporeMat, burstMat]);

  const S = useRef({ phase: 'assemble' as Phase, t0: -1 });
  const tilt = useRef({ x: 0, y: 0 });
  const { gl } = useThree();
  useEffect(() => { sporeU.uPx.value = burstU.uPx.value = Math.min(gl.getPixelRatio(), 2); }, [gl, sporeU, burstU]);

  const go = (p: Phase, now: number) => { S.current.phase = p; S.current.t0 = now; onPhase(p); };

  useFrame((state, dt) => {
    const now = state.clock.elapsedTime, st = S.current, k = reduce ? 0.25 : 1;
    if (st.t0 < 0) st.t0 = now;
    const el = now - st.t0, g = group.current; if (!g) return;
    const vw = state.viewport.width, vh = state.viewport.height;
    const s = Math.min(1.1, vw / 2.6); // fit the leaf on narrow (mobile) screens
    u.uTime.value = now;
    let shrink = 1;

    if (st.phase === 'assemble') {
      u.uAppear.value = clamp01(el / (0.4 * k));
      let finished = true;
      frags.current.forEach((f, i) => {
        if (!f) return;
        const v = variation[i], from = FRAGMENTS[i].from;
        const p = clamp01((el - DELAYS[i] * k) / (v.dur * k));
        if (p < 1) finished = false;
        const e = easeOutBack(p, 0.9), er = easeOutCubic(p);
        // start well outside the viewport (in leaf-local units), then spring toward the origin
        f.position.set((from[0] * (vw / 2 + 2.2)) / s * (1 - e), (from[1] * (vh / 2 + 2.2)) / s * (1 - e), v.z * (1 - e));
        f.rotation.set(v.rot.x * (1 - er), v.rot.y * (1 - er), v.rot.z * (1 - er));
        f.scale.setScalar(v.s0 + (1 - v.s0) * e);
      });
      if (finished && el > 1.5 * k) {
        frags.current.forEach((f) => { f?.position.set(0, 0, 0); f?.rotation.set(0, 0, 0); f?.scale.setScalar(1); });
        go('hollow', now);
      }
    } else if (st.phase === 'hollow') {
      u.uGlow.value = 1 + 0.25 * Math.sin(now * 2.2); // pulsing glass while waiting for the verdict
      if (outcomeRef.current !== 'pending' && el > 1.1 * k) {
        const pal = PALETTES[outcomeRef.current];
        u.uColA.value.set(pal.A); u.uColB.value.set(pal.B); u.uColC.value.set(pal.C); u.uVein.value.set(pal.vein); u.uAccent.value.set(pal.accent); u.uIri.value = pal.iri;
        sporeU.uColor.value.set(pal.spore); burstU.uColor.value.set(pal.accent);
        const healthy = outcomeRef.current === 'healthy';
        sporeU.uDir.value = healthy ? 1 : -0.5; sporeU.uSpread.value = healthy ? 1 : 2.2; // rising chlorophyll vs. drifting dark dust
        sporeMat.blending = healthy ? THREE.AdditiveBlending : THREE.NormalBlending; sporeMat.needsUpdate = true;
        go('fill', now);
      }
    } else if (st.phase === 'fill') {
      const p = clamp01(el / (5.2 * k));
      u.uFill.value = easeInOutSine(p); u.uGlow.value = 1;
      sporeU.uAlpha.value = reduce ? 0 : Math.min(1, p * 3) * (outcomeRef.current === 'healthy' ? 0.9 : 0.75);
      if (p >= 1) go('ready', now);
    } else if (st.phase === 'ready') {
      u.uFill.value = 1;
      if (dismissRef.current) { burstU.uT.value = 0.0001; go('dissolve', now); }
    } else if (st.phase === 'dissolve') {
      const p = clamp01(el / (1.5 * k)), e = easeInOutCubic(p);
      u.uDissolve.value = e; shrink = 1 - 0.28 * e;
      burstU.uT.value = reduce ? 0 : Math.max(0.0001, p);
      sporeU.uAlpha.value *= 0.9;
      if (p >= 1) { go('done', now); }
    }

    // breathing + pointer tilt (smoothed). Whole leaf group, so all fragments move together.
    tilt.current.x = THREE.MathUtils.damp(tilt.current.x, state.pointer.x, 4, dt);
    tilt.current.y = THREE.MathUtils.damp(tilt.current.y, state.pointer.y, 4, dt);
    const breathe = reduce ? 1 : 1 + 0.012 * Math.sin(now * 1.6);
    g.scale.setScalar(s * breathe * shrink);
    g.rotation.y = (reduce ? 0 : 0.16 * Math.sin(now * 0.5)) + tilt.current.x * 0.35;
    g.rotation.x = -tilt.current.y * 0.25;
    g.rotation.z = reduce ? 0 : 0.04 * Math.sin(now * 0.7);
  });

  return (
    <group ref={group}>
      {FRAGMENTS.map((f, i) => (
        <group key={f.id} ref={(el) => { frags.current[i] = el; }} scale={0.0001}>
          <mesh geometry={geos[i]} material={material} frustumCulled={false} />
        </group>
      ))}
      {!reduce && <points geometry={sporeGeo} material={sporeMat} frustumCulled={false} />}
      {!reduce && <points geometry={burstGeo} material={burstMat} frustumCulled={false} />}
    </group>
  );
}
