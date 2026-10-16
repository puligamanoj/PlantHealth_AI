import { Y_MAX, Y_MIN } from './leafGeometry';

/** Colour palettes for the two outcomes. `glass` is the neutral hollow-membrane tint used before the verdict. */
export const PALETTES = {
  healthy: { A: '#0a4a2b', B: '#1f9d57', C: '#b4f07c', vein: '#d6ffa8', accent: '#e9c46a', spore: '#f4e28a', iri: 1 },
  diseased: { A: '#2b0307', B: '#8f0f1f', C: '#e03a3a', vein: '#ff8a70', accent: '#f2a541', spore: '#2a1a16', iri: 0 },
} as const;
export const GLASS = '#c4efe0';

export const LEAF_VERT = /* glsl */ `
attribute vec2 aLeaf; // (u across blade -1..1, t along leaf)
uniform float uTime;
varying vec3 vN; varying vec3 vV; varying vec3 vLeaf; varying vec2 vL;
void main(){
  vLeaf = position; vL = aLeaf;
  vec3 p = position;
  // "breathing": tiny travelling undulation, strongest at the margins
  p.z += 0.012 * sin(uTime*1.7 + position.y*3.0) * abs(aLeaf.x);
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

/**
 * Fill logic: all fragments share this material and read LEAF-SPACE position (vLeaf), so the fill front is one
 * continuous plane sweeping tip -> base across the whole assembled leaf. A noisy edge (fbm + margin lag) makes it
 * organic. Below the front = glass (fresnel rim + vein lines + faint membrane); above = pigmented, veined,
 * back-lit (cheap subsurface scattering) tissue. uDissolve eats the leaf away with a glowing noise threshold.
 */
export const LEAF_FRAG = /* glsl */ `
uniform float uTime, uFill, uDissolve, uAppear, uGlow, uIri;
uniform vec3 uColA, uColB, uColC, uVein, uGlass, uAccent;
varying vec3 vN; varying vec3 vV; varying vec3 vLeaf; varying vec2 vL;
const float YMIN = ${Y_MIN.toFixed(2)}; const float YMAX = ${Y_MAX.toFixed(2)};
float hash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x), f.y), f.z);
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*noise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(vV);
  if(!gl_FrontFacing) N = -N;
  float yN = clamp((vLeaf.y-YMIN)/(YMAX-YMIN), 0.0, 1.0);
  float tt = vL.y; float au = abs(vL.x);
  float n1 = fbm(vec3(vLeaf.xy*2.2, uTime*0.05));

  // ---- fill front (tip -> base) ----
  float fillLine = mix(1.12, -0.14, uFill);
  float front = yN + (n1-0.5)*0.18 + au*0.05;
  float filled = smoothstep(fillLine-0.035, fillLine+0.035, front);

  // ---- veins: midrib + lateral veins sweeping toward the tip + fine reticulation ----
  float th = mix(0.034, 0.008, clamp(tt,0.0,1.0));
  float mid = 1.0 - smoothstep(th*0.5, th, abs(vLeaf.x));
  float d = abs(fract((tt - 0.42*au)*10.0) - 0.5);
  float lat = smoothstep(0.44, 0.5, d) * smoothstep(0.04, 0.14, au) * (1.0 - smoothstep(0.85, 1.0, au));
  float ret = (1.0 - smoothstep(0.0, 0.06, abs(noise(vec3(vLeaf.xy*16.0, 1.0)) - 0.5))) * step(0.05, au);
  float veinMask = clamp(mid + lat*0.8 + ret*0.2, 0.0, 1.0);

  // ---- lighting: wrap diffuse, fresnel, back-lit translucency ----
  vec3 L = normalize(vec3(0.4,0.7,0.8)); vec3 R = normalize(vec3(-0.7,0.3,-0.6));
  float diff = dot(N,L)*0.5+0.5;
  float fres = pow(1.0-abs(dot(N,V)), 2.5);
  float sss = pow(clamp(dot(V,-L),0.0,1.0), 2.0)*0.6 + pow(clamp(dot(N,R),0.0,1.0), 2.0)*0.35;

  // ---- pigmented tissue ----
  float mott = fbm(vec3(vLeaf.xy*6.0+3.0, uTime*0.03));
  vec3 base = mix(uColA, uColB, smoothstep(0.1, 0.9, yN*0.5 + mott*0.7));
  base = mix(base, uColC, smoothstep(0.55, 0.95, mott)*0.5);
  base = mix(base, uVein, veinMask*0.55);
  vec3 iri = 0.5 + 0.5*cos(6.2831*(fres*1.2 + yN*0.6 + vec3(0.0,0.33,0.67)) + uTime*0.4);
  vec3 col = base*(0.35+0.85*diff) + uColC*sss + uAccent*fres*0.5 + iri*uIri*fres*0.35;

  // ---- glass membrane (before the fill reaches this point) ----
  float edge = smoothstep(0.88, 1.0, au);
  vec3 glassCol = uGlass*(0.25 + fres*1.6 + veinMask*0.9 + edge*1.1)*uGlow;
  float glassA = clamp(0.07 + fres*0.45 + veinMask*0.45 + edge*0.55, 0.0, 0.95);

  // glowing "life energy" band riding the fill front
  float band = exp(-pow((front-fillLine)/0.05, 2.0)) * step(0.001,uFill) * step(uFill,0.995);
  vec3 outc = mix(glassCol, col, filled) + uAccent*band*1.2;
  float alpha = max(mix(glassA, 0.94, filled), band*0.9);

  // ---- dissolve (noise threshold with hot edge) ----
  if(uDissolve > 0.0){
    float dn = fbm(vec3(vLeaf.xy*3.0, 7.0));
    float thr = dn - (uDissolve*1.15 - 0.05);
    if(thr < 0.0) discard;
    outc += uAccent*smoothstep(0.08, 0.0, thr)*2.0;
  }
  gl_FragColor = vec4(outc, alpha*uAppear);
  #include <colorspace_fragment>
}`;

export const SPORE_VERT = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime, uFill, uSize, uPx, uAlpha, uDir, uSpread;
varying float vA;
const float YMIN = ${Y_MIN.toFixed(2)}; const float YMAX = ${Y_MAX.toFixed(2)};
void main(){
  float life = fract(uTime*(0.12+0.18*aSeed.x) + aSeed.y);
  vec3 p = position;
  float yN = (p.y-YMIN)/(YMAX-YMIN);
  float fillLine = mix(1.12, -0.14, uFill);
  float active = step(fillLine, yN) * step(0.001, uFill); // only where the leaf is already filled
  p.y += life*1.1*uDir;
  p.x += sin(uTime*0.8 + aSeed.z*6.2831)*0.08*life + (aSeed.x-0.5)*0.3*life*uSpread;
  p.z += 0.15 + life*0.4;
  vA = sin(life*3.14159) * active * uAlpha;
  vec4 mv = modelViewMatrix*vec4(p,1.0);
  gl_PointSize = uSize*uPx*(0.5+aSeed.x)*(1.0+life*0.4)*(7.0/-mv.z);
  gl_Position = projectionMatrix*mv;
}`;
export const BURST_VERT = /* glsl */ `
attribute vec3 aVel;
uniform float uT, uSize, uPx;
varying float vA;
void main(){
  vec3 p = position + aVel*(1.0-exp(-3.2*uT))*1.4;
  p.y -= 0.2*uT*uT;
  vA = (1.0-uT)*step(0.0001,uT);
  vec4 mv = modelViewMatrix*vec4(p,1.0);
  gl_PointSize = uSize*uPx*(1.0-0.5*uT)*(7.0/-mv.z);
  gl_Position = projectionMatrix*mv;
}`;
export const POINT_FRAG = /* glsl */ `
uniform vec3 uColor; varying float vA;
void main(){
  float d = length(gl_PointCoord-0.5);
  float a = smoothstep(0.5, 0.0, d)*vA;
  if(a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;
