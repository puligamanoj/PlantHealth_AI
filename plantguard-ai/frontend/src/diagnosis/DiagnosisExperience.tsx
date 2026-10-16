import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence } from 'framer-motion';
import Leaf, { type Outcome, type Phase } from './LeafAssembly';
import FallingLeaves from './FallingLeaves';
import ResultPanel from './ResultPanel';
import { LABELS } from './labels';
import type { Lang, Report } from './report';
import './dx.css';

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

interface Props { outcome: Outcome; report: Report | null; lang: Lang; onClose: () => void }

/**
 * Full-screen diagnosis stage. Mount it the moment analysis STARTS (outcome='pending'): the leaf assembles and
 * waits as a glass shell while the API runs, then fills green/red once `outcome` becomes known.
 * Click/tap (or Enter/Space) while the leaf is 'ready' dissolves it and reveals ResultPanel.
 */
export default function DiagnosisExperience({ outcome, report, lang, onClose }: Props) {
  const L = LABELS[lang];
  const reduce = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const webgl = useMemo(hasWebGL, []);
  const [phase, setPhase] = useState<Phase>(webgl ? 'assemble' : 'hollow');
  const [dismiss, setDismiss] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const count = useMemo(() => (reduce ? 0 : window.innerWidth < 700 ? 34 : 64), [reduce]);

  useEffect(() => { root.current?.focus(); }, []);
  // No WebGL: skip the 3D sequence and go straight to the result once it exists.
  useEffect(() => { if (!webgl && report) setPhase('done'); }, [webgl, report]);

  const advance = useCallback(() => { if (phase === 'ready') setDismiss(true); }, [phase]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if ((e.key === 'Enter' || e.key === ' ') && phase === 'ready') { e.preventDefault(); advance(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [phase, advance, onClose]);

  const state = outcome === 'pending' ? 'pending' : outcome;
  const status = phase === 'ready' ? L.tap : outcome === 'pending' ? L.analyzing : phase === 'fill' || phase === 'hollow' ? L.revealing : phase === 'assemble' ? L.analyzing : '';

  return (
    <div ref={root} tabIndex={-1} className="dx-root" data-state={state} role="dialog" aria-modal="true" aria-label={L.aria}>
      <div className="dx-bokeh" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      {webgl && (
        <div className="dx-stage" data-ready={phase === 'ready'} onClick={advance}>
          <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 7], fov: 38, near: 0.1, far: 60 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
            <fog key={state} attach="fog" args={[outcome === 'diseased' ? '#140608' : '#06130c', 6, 17]} />
            <ambientLight intensity={0.7} color="#cfeedd" />
            <directionalLight position={[3, 4, 5]} intensity={2.2} color="#fff4e0" />
            <directionalLight position={[-4, 2, -3]} intensity={1.3} color={outcome === 'diseased' ? '#ff9a8a' : '#9fffd0'} />
            <Suspense fallback={null}>
              {count > 0 && <FallingLeaves diseased={outcome === 'diseased'} count={count} />}
              {phase !== 'done' && <Leaf outcome={outcome} dismiss={dismiss} reduce={reduce} onPhase={setPhase} />}
            </Suspense>
          </Canvas>
        </div>
      )}
      {phase !== 'done' && (
        <div className="dx-status" aria-live="polite">
          <span className={'dx-ring' + (outcome === 'pending' ? ' spin' : '')} aria-hidden="true" />
          <p className={phase === 'ready' ? 'pulse' : ''}>{status}</p>
        </div>
      )}
      {phase !== 'done' && (
        <div className="dx-top">
          {report && phase !== 'dissolve' && <button className="dx-btn ghost small" onClick={(e) => { e.stopPropagation(); setPhase('done'); }}>{L.skip}</button>}
          <button className="dx-btn ghost small" onClick={(e) => { e.stopPropagation(); onClose(); }}>{L.close}</button>
        </div>
      )}
      <AnimatePresence>{phase === 'done' && report && <ResultPanel key="panel" report={report} lang={lang} onDone={onClose} onNew={onClose} />}</AnimatePresence>
    </div>
  );
}
