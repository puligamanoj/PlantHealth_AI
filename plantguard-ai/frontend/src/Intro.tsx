import { useEffect, useState } from 'react';
export default function Intro(){
 const [visible,setVisible]=useState(()=>!sessionStorage.getItem('pg-intro-seen'));
 useEffect(()=>{if(!visible)return;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const timer=window.setTimeout(()=>finish(),reduced?500:9000);return()=>window.clearTimeout(timer);},[visible]);
 function finish(){sessionStorage.setItem('pg-intro-seen','1');setVisible(false);}
 if(!visible)return null;
 return <div className="intro-overlay" role="dialog" aria-label="PlantGuard AI introduction"><button className="intro-skip" onClick={finish}>Skip intro ↗</button><div className="intro-brand"><span>🌿</span><strong>PlantGuard <i>AI</i></strong><small>FIELD HEALTH INTELLIGENCE</small></div><div className="intro-leaf" aria-hidden="true">{Array.from({length:8},(_,i)=><span key={i} className={'leaf-fragment fragment-'+i}>◢</span>)}</div><p>Growing insight, one leaf at a time.</p></div>
}
