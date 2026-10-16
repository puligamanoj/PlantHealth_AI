import { motion } from 'framer-motion';
import { AlertTriangle, Check, FlaskConical, Info, Leaf, Sprout } from 'lucide-react';
import type { Lang, Report } from './report';
import { LABELS } from './labels';

const list = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 140, damping: 20 } } };

/** Glass result panel. Springs in right after the leaf has dissolved. */
export default function ResultPanel({ report, lang, onDone, onNew }: { report: Report; lang: Lang; onDone: () => void; onNew: () => void }) {
  const L = LABELS[lang], sev = report.severity, sevIdx = sev ? ['mild', 'moderate', 'severe'].indexOf(sev) : -1;
  const title = report.healthy ? L.healthy : report.title || '—';
  return (
    <motion.div className="dx-panel-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className="dx-panel" role="region" aria-label={L.aria} initial={{ opacity: 0, y: 40, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
        {report.preview && <div className="dx-banner"><Info size={14} />{L.preview}</div>}
        <motion.div variants={list} initial="hidden" animate="show">
          <motion.header variants={item} className="dx-head">
            <span className="dx-badge">{report.healthy ? <Check size={22} /> : <AlertTriangle size={22} />}</span>
            <div>
              <small>{report.crop || 'PlantGuard AI'}</small>
              <h2>{title}</h2>
            </div>
            {report.confidence !== null && <div className="dx-conf"><strong>{(report.confidence * 100).toFixed(1)}%</strong><small>{L.confidence}</small></div>}
          </motion.header>
          {report.lowConfidence && <motion.div variants={item} className="dx-warn"><AlertTriangle size={14} />{L.lowConf}</motion.div>}

          {!report.healthy && (
            <motion.div variants={item} className="dx-card">
              <h3><AlertTriangle size={15} />{L.severity}</h3>
              {sev ? (
                <><div className="dx-sev" role="img" aria-label={L[sev]}>{[0, 1, 2].map((i) => <span key={i} data-on={i <= sevIdx} data-lvl={i} />)}</div><p className="dx-sevlabel">{L[sev]}</p></>
              ) : <p className="dx-muted">{L.notAssessed}</p>}
            </motion.div>
          )}
          <motion.div variants={item} className="dx-card"><h3><Leaf size={15} />{L.about}</h3><p>{report.description}</p></motion.div>
          <div className="dx-grid">
            <motion.div variants={item} className="dx-card"><h3><Sprout size={15} />{L.care}</h3><ul>{report.care.map((c) => <li key={c}>{c}</li>)}</ul></motion.div>
            <motion.div variants={item} className="dx-card"><h3><FlaskConical size={15} />{L.treat}</h3><ul>{[...report.fertilizer, ...report.treatments].map((c) => <li key={c}>{c}</li>)}</ul></motion.div>
          </div>
          {report.advice && <motion.p variants={item} className="dx-advice">{report.advice}</motion.p>}
          <motion.p variants={item} className="dx-foot">{L.refText}</motion.p>
          <motion.div variants={item} className="dx-actions"><button className="dx-btn ghost" onClick={onNew}>{L.newScan}</button><button className="dx-btn" onClick={onDone}>{L.done}</button></motion.div>
        </motion.div>
      </motion.section>
    </motion.div>
  );
}
