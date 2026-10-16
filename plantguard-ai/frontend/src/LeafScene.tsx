import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function LeafScene() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 7);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xb9ffd9, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(3, 4, 5); scene.add(light);
    const group = new THREE.Group(); scene.add(group);
    // Procedural tapered leaf surface; actual Three.js geometry, not a flat SVG icon.
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const rows = 42, cols = 24;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows, y = (t - .5) * 3.4, width = Math.sin(Math.PI * t) * .92;
      for (let j = 0; j <= cols; j++) {
        const u = j / cols * 2 - 1;
        positions.push(u * width, y, .18 * (1-u*u) * Math.sin(t*Math.PI) + .07*Math.sin(t*12)*Math.abs(u));
        uvs.push(j/cols, t);
      }
    }
    for (let i=0;i<rows;i++) for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2)); geo.setIndex(indices); geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({color:0x22a06b,roughness:.38,metalness:.05,side:THREE.DoubleSide,emissive:0x06331e,emissiveIntensity:.3});
    const leaf = new THREE.Mesh(geo,mat); group.add(leaf);
    const veinMat = new THREE.LineBasicMaterial({color:0x9af0bd,transparent:true,opacity:.72});
    const veinPts = [new THREE.Vector3(0,-1.58,.19),new THREE.Vector3(0,0,.24),new THREE.Vector3(0,1.58,.19)];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(veinPts),veinMat));
    for(let k=1;k<=7;k++){const t=k/8,y=(t-.5)*3.1,w=Math.sin(Math.PI*t)*.78; for(const side of [-1,1]){const pts=[new THREE.Vector3(0,y,.22),new THREE.Vector3(side*w*.48,y+.18,.18),new THREE.Vector3(side*w,y+.27,.13)];group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),veinMat));}}
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame=0, raf=0, pointerX=0,pointerY=0;
    const onMove=(e:PointerEvent)=>{const r=el.getBoundingClientRect();pointerX=((e.clientX-r.left)/r.width-.5);pointerY=((e.clientY-r.top)/r.height-.5);};
    el.addEventListener('pointermove',onMove);
    const resize=()=>{if(!el.clientWidth||!el.clientHeight)return;camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);};
    const observer=new ResizeObserver(resize); observer.observe(el);
    const animate=()=>{raf=requestAnimationFrame(animate);if(!document.hidden){frame+=.012;if(!reduce){group.rotation.y=.25*Math.sin(frame*.6)+pointerX*.22;group.rotation.x=.1*Math.sin(frame)+pointerY*.18;group.rotation.z=.06*Math.sin(frame*.8);}renderer.render(scene,camera);}};
    animate();
    const visibility=()=>{if(document.hidden)cancelAnimationFrame(raf);else animate();};
    document.addEventListener('visibilitychange',visibility);
    return ()=>{cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);el.removeEventListener('pointermove',onMove);observer.disconnect();geo.dispose();mat.dispose();veinMat.dispose();renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <div className="leaf-scene" ref={host} aria-label="Interactive three-dimensional botanical leaf" role="img"/>;
}
