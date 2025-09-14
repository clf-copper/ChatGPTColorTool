import React, { useMemo, useState, useEffect, useRef } from "react";

// -------------------------------------------
// Preview Controls
// -------------------------------------------
const useDarkMode = false;
const usePreviewColors = true;

// -------------------------------------------
// Color Utilities (sRGB D65)
// -------------------------------------------
const clamp = (n, min = 0, max = 255) => Math.min(max, Math.max(min, n));
const toHex = (v) => clamp(Math.round(v)).toString(16).padStart(2, "0").toUpperCase();
const rgbToHex = ({ r, g, b }) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;
const hexToRgb = (hex) => {
  const h = (hex || "").replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
  if (h.length !== 6) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
};

const srgbToLinear = (c) => { c = c / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const linearToSrgb = (c) => { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
const lrv = ({ r, g, b }) => { const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b); const Y = 0.2126*R+0.7152*G+0.0722*B; return Math.round(Y*1000)/10; };

// XYZ/Lab (D65)
function rgbToXyz({ r, g, b }){
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  // sRGB to XYZ (D65)
  const X = R*0.4124564 + G*0.3575761 + B*0.1804375;
  const Y = R*0.2126729 + G*0.7151522 + B*0.0721750;
  const Z = R*0.0193339 + G*0.1191920 + B*0.9503041;
  return { X, Y, Z };
}
function xyzToLab({ X, Y, Z }){
  // D65 white
  const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
  const f = (t)=> t > 216/24389 ? Math.cbrt(t) : (841/108)*t + 4/29;
  const fx = f(X/Xn), fy = f(Y/Yn), fz = f(Z/Zn);
  const L = 116*fy - 16;
  const a = 500*(fx - fy);
  const b = 200*(fy - fz);
  return { L, a, b };
}
const rgbToLab = (rgb)=> xyzToLab(rgbToXyz(rgb));

// LRV setter
const clamp01 = (x)=>Math.max(0,Math.min(1,x));
const colorWithLRV = (col, targetLRV)=>{
  if (isNaN(targetLRV)) return col;
  const tgt = Math.max(0, Math.min(100, targetLRV));
  const Rt = srgbToLinear(col.r), Gt = srgbToLinear(col.g), Bt = srgbToLinear(col.b);
  const Y = 0.2126*Rt + 0.7152*Gt + 0.0722*Bt;
  const Ty = tgt/100;
  if (Y <= 1e-6) {
    const lin = clamp01(Ty);
    const to8 = v => clamp(Math.round(linearToSrgb(lin)*255));
    return { r: to8(lin), g: to8(lin), b: to8(lin) };
  }
  const k = Ty / Y;
  const to8 = v => clamp(Math.round(linearToSrgb(v)*255));
  return {
    r: to8(clamp01(Rt*k)),
    g: to8(clamp01(Gt*k)),
    b: to8(clamp01(Bt*k)),
  };
};

// Mixers
const mix2 = (A,B,t)=>{ const mix=(x,y,t)=>x*(1-t)+y*t; const to8=(v)=>clamp(Math.round(linearToSrgb(v)*255));
  const ch=(ca,cb)=>to8(mix(srgbToLinear(ca),srgbToLinear(cb),t)); return { r:ch(A.r,B.r), g:ch(A.g,B.g), b:ch(A.b,B.b) }; };
const mix3 = (A,B,C,tAB,tC)=>{ const mix=(x,y,t)=>x*(1-t)+y*t; const to8=(v)=>clamp(Math.round(linearToSrgb(v)*255));
  const ch=(ca,cb,cc)=>{ const ab=mix(srgbToLinear(ca),srgbToLinear(cb),tAB); const abc=mix(ab,srgbToLinear(cc),tC); return to8(abc); };
  return { r:ch(A.r,B.r,C.r), g:ch(A.g,B.g,C.g), b:ch(A.b,B.b,C.b) }; };

// -------------------------------------------
// UI atoms
// -------------------------------------------
const textClass = useDarkMode ? "text-white" : "text-gray-900";
const labelClass = useDarkMode ? "text-white" : "text-gray-800";
const inputClass = useDarkMode ? "bg-black text-white" : "bg-white text-black";
const bgClass = useDarkMode ? "bg-black" : "bg-white";

const Swatch = ({ color, h=24 }) => (<div className="rounded border" style={{height:h, backgroundColor:rgbToHex(color)}}/>);
const TextInput = ({ value, onChange, placeholder, className="" }) => (
  <input type="text" value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}
    className={`rounded-md border px-2 py-1 ${inputClass} ${className}`}/>
);
const NumInput = ({ value, onChange, min=0, max=100, step=0.1, className="" }) => (
  <input type="number" value={value} min={min} max={max} step={step}
    onChange={(e)=>onChange(parseFloat(e.target.value))}
    className={`rounded-md border px-2 py-1 ${inputClass} ${className}`}/>
);

// -------------------------------------------
// Pantry (demo data) — replace with your real source later
// -------------------------------------------
const DEMO_PANTRY = [
  { id: "bm-oc-17", mfr: "Benjamin Moore", type: "Interior Eggshell", name: "White Dove OC-17", hex: "#EAE9E2" },
  { id: "sw-7008",  mfr: "Sherwin-Williams", type: "Interior Matte", name: "Alabaster SW 7008", hex: "#EEEAE1" },
  { id: "bm-hc-172", mfr: "Benjamin Moore", type: "Advance Satin", name: "Revere Pewter HC-172", hex: "#CCC7B9" },
  { id: "sw-9130",  mfr: "Sherwin-Williams", type: "Interior Satin", name: "Cadet SW 9130", hex: "#7E8D96" },
  { id: "pp-royal", mfr: "PPG", type: "Interior Semi-Gloss", name: "Royal Blue", hex: "#2456C2" },
];

function enrichPaint(p){
  const rgb = hexToRgb(p.hex) || {r:240,g:240,b:240};
  const lab = rgbToLab(rgb);
  return { ...p, rgb, lrv: lrv(rgb), lab };
}

// -------------------------------------------
// Pantry Picker
// -------------------------------------------
function PantryPicker({ pantry, onMix }){
  const [selected, setSelected] = useState([]); // ids
  const toggle = (id)=> setSelected(s=> s.includes(id) ? s.filter(x=>x!==id) : (s.length<3 ? [...s,id] : s));
  const paints = pantry.map(enrichPaint);
  const chosen = selected.map(id => paints.find(p=>p.id===id)).filter(Boolean);

  const canMix = chosen.length>=2 && chosen.length<=3;
  const disabledReason = chosen.length<2 ? "Select 2–3 paints" : chosen.length>3 ? "Max 3" : "";

  return (
    <div className="space-y-4">
      <div className="text-xl font-semibold">Paint Pantry</div>
      <div className="grid gap-3">
        {paints.map(p => (
          <label key={p.id} className={`flex items-center gap-3 rounded-lg border p-2 ${useDarkMode?"hover:bg-zinc-900":"hover:bg-zinc-50"}`}>
            <input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggle(p.id)} />
            <Swatch color={p.rgb} h={20}/>
            <div className="flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs opacity-70">{p.mfr} · {p.type} · {p.hex} · LRV {p.lrv.toFixed(1)} · Lab {p.lab.L.toFixed(1)},{p.lab.a.toFixed(1)},{p.lab.b.toFixed(1)}</div>
            </div>
          </label>
        ))}
      </div>
      <button
        disabled={!canMix}
        onClick={()=> onMix(chosen)}
        className={`rounded-md px-4 py-2 font-semibold border ${canMix? (useDarkMode?"bg-white text-black":"bg-black text-white") : "opacity-50"}`}
      >Mix</button>
      {!canMix && <div className="text-xs opacity-70">{disabledReason}</div>}
    </div>
  );
}

// -------------------------------------------
// 2‑Color Mixer (embedded)
// -------------------------------------------
function TwoColorMixer({ initialA, initialB }){
  const [colorA,setColorA] = useState(initialA?.rgb || {r:236,g:231,b:222});
  const [colorB,setColorB] = useState(initialB?.rgb || {r:214,g:200,b:183});
  const [metaA,setMetaA] = useState({mfr: initialA?.mfr||"", type: initialA?.type||"", name: initialA?.name||""});
  const [metaB,setMetaB] = useState({mfr: initialB?.mfr||"", type: initialB?.type||"", name: initialB?.name||""});
  const [tB,setTB] = useState(0.5);

  const result = useMemo(()=>mix2(colorA,colorB,tB),[colorA,colorB,tB]);

  const inputClass = useDarkMode ? "bg-black text-white" : "bg-white text-black";
  const labelClass = useDarkMode ? "text-white" : "text-gray-800";
  const textClass  = useDarkMode ? "text-white" : "text-gray-900";

  const LrvField = ({color,setColor}) => (
    <input type="number" min={0} max={100} step={0.1} value={Number(lrv(color).toFixed(1))}
      onChange={(e)=>{ const v=parseFloat(e.target.value); if(!Number.isNaN(v)) setColor(colorWithLRV(color,v)); }}
      className={`w-24 rounded-md border px-2 py-1 ${inputClass}`} />
  );

  const Editor = ({title,color,setColor,meta,setMeta})=> (
    <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 items-center">
      <div className="col-span-2 text-xl font-semibold text-black">{title}</div>
      <div className="col-span-2 grid grid-cols-1 gap-2 md:grid-cols-3">
        <input className={`rounded-md border px-2 py-1 ${inputClass}`} placeholder="Manufacturer" value={meta.mfr} onChange={e=>setMeta({...meta,mfr:e.target.value})}/>
        <input className={`rounded-md border px-2 py-1 ${inputClass}`} placeholder="Paint Type (e.g., Eggshell)" value={meta.type} onChange={e=>setMeta({...meta,type:e.target.value})}/>
        <input className={`rounded-md border px-2 py-1 ${inputClass}`} placeholder="Color Name / Code" value={meta.name} onChange={e=>setMeta({...meta,name:e.target.value})}/>
      </div>
      <div className="row-span-4 flex items-center"><div className="h-40 w-5 rounded-lg border" style={{backgroundColor:rgbToHex(color)}}/></div>
      <div className={`text-sm font-semibold ${labelClass}`}>RGB</div>
      <div className={`flex gap-2 font-medium ${textClass}`}>
        <input type="number" className={`w-20 rounded-md border px-2 py-1 ${inputClass}`} value={color.r} onChange={(e)=>setColor({...color,r:clamp(+e.target.value)})}/>
        <input type="number" className={`w-20 rounded-md border px-2 py-1 ${inputClass}`} value={color.g} onChange={(e)=>setColor({...color,g:clamp(+e.target.value)})}/>
        <input type="number" className={`w-20 rounded-md border px-2 py-1 ${inputClass}`} value={color.b} onChange={(e)=>setColor({...color,b:clamp(+e.target.value)})}/>
      </div>
      <div className={`text-sm font-semibold ${labelClass}`}>HEX</div>
      <input type="text" className={`w-36 rounded-md border px-2 py-1 ${inputClass}`} value={rgbToHex(color)} onChange={(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb) setColor(rgb); }}/>
      <div className={`text-sm font-semibold ${labelClass}`}>LRV</div>
      <LrvField color={color} setColor={setColor}/>
    </div>
  );

  return (
    <div className="grid gap-8 md:grid-cols-[1.2fr,0.8fr]">
      <div className="space-y-8">
        <div className="grid gap-8 md:grid-cols-2">
          <Editor title="Color A" color={colorA} setColor={setColorA} meta={metaA} setMeta={setMetaA}/>
          <Editor title="Color B" color={colorB} setColor={setColorB} meta={metaB} setMeta={setMetaB}/>
        </div>
        <div className="space-y-4">
          <div className={`text-sm font-semibold ${labelClass}`}>Blend A ↔ B</div>
          <div className="h-6 w-full rounded-full border" style={{background:`linear-gradient(90deg, ${rgbToHex(colorA)} 0%, ${rgbToHex(colorB)} 100%)`}}/>
          <input type="range" min={0} max={100} value={Math.round(tB*100)} onChange={(e)=>setTB(Number(e.target.value)/100)} className="w-full"/>
        </div>
      </div>
      <div className="space-y-4">
        <div className={`text-lg font-bold ${labelClass}`}>Result</div>
        <div className="h-24 w-full rounded-xl border shadow-sm" style={{backgroundColor:rgbToHex(result)}}/>
        <div className="grid grid-cols-2 gap-3 text-sm items-center">
          <div className={`font-semibold ${labelClass}`}>HEX</div><div className={`font-mono ${textClass}`}>{rgbToHex(result)}</div>
          <div className={`font-semibold ${labelClass}`}>RGB</div><div className={`font-mono ${textClass}`}>{`${result.r}, ${result.g}, ${result.b}`}</div>
          <div className={`font-semibold ${labelClass}`}>LRV</div><div className={`font-mono ${textClass}`}>{lrv(result).toFixed(1)}</div>
          <div className={`font-semibold ${labelClass}`}>CIELAB</div><div className={`font-mono ${textClass}`}>{Object.values(rgbToLab(result)).map(n=>n.toFixed(1)).join(", ")}</div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------
// 3‑Color Mixer (embedded)
// -------------------------------------------
function ThreeColorMixer({ initialA, initialB, initialC }){
  const [colorA,setColorA] = useState(initialA?.rgb || {r:236,g:231,b:222});
  const [colorB,setColorB] = useState(initialB?.rgb || {r:214,g:200,b:183});
  const [colorC,setColorC] = useState(initialC?.rgb || {r:180,g:170,b:160});
  const [metaA,setMetaA] = useState({mfr: initialA?.mfr||"", type: initialA?.type||"", name: initialA?.name||""});
  const [metaB,setMetaB] = useState({mfr: initialB?.mfr||"", type: initialB?.type||"", name: initialB?.name||""});
  const [metaC,setMetaC] = useState({mfr: initialC?.mfr||"", type: initialC?.type||"", name: initialC?.name||""});
  const [tAB,setTAB] = useState(0.5);
  const [tC,setTC]   = useState(0.5);

  const result = useMemo(()=>mix3(colorA,colorB,colorC,tAB,tC),[colorA,colorB,colorC,tAB,tC]);

  const inputClass = useDarkMode ? "bg-black text-white" : "bg-white text-black";
  const labelClass = useDarkMode ? "text-white" : "text-gray-800";
  const textClass  = useDarkMode ? "text-white" : "text-gray-900";

  const LrvField = ({color,setColor}) => (
    <input type="number" min={0} max={100} step={0.1} value={Number(lrv(color).toFixed(1))}
      onChange={(e)=>{ const v=parseFloat(e.target.value); if(!Number.isNaN(v)) setColor(colorWithLRV(color,v)); }}
      className={`w-24 rounded-md border px-2 py-1 ${inputClass}`} />
  );

  const Editor = ({title,color,setColor,meta,setMeta})=> (
    <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 items-center">
      <div className="col-span-2 text-xl font-semibold text-black">{title}</div>
      <div className="col-span-2 grid grid-cols-1 gap-2 md:grid-cols-3">
        <input className={`rounded-md border px-2 py-1 ${inputClass}`} placeholder="Manufacturer" value={meta.mfr} onChange={e=>setMeta({...meta,mfr:e.target.value})}/>
        <input className={`rounded-md border px-2 py-1 ${inputClass}`} placeholder="Paint Type (e.g., Eggshell)" value={meta.type} onChange={e=>setMeta({...meta,type:e.target.value})}/>
        <input className={`rounded-md border px-2 py-1 ${inputClass}`} placeholder="Color Name / Code" value={meta.name} onChange={e=>setMeta({...meta,name:e.target.value})}/>
      </div>
      <div className="row-span-4 flex items-center"><div className="h-40 w-5 rounded-lg border" style={{backgroundColor:rgbToHex(color)}}/></div>
      <div className={`text-sm font-semibold ${labelClass}`}>RGB</div>
      <div className={`flex gap-2 font-medium ${textClass}`}>
        <input type="number" className={`w-20 rounded-md border px-2 py-1 ${inputClass}`} value={color.r} onChange={(e)=>setColor({...color,r:clamp(+e.target.value)})}/>
        <input type="number" className={`w-20 rounded-md border px-2 py-1 ${inputClass}`} value={color.g} onChange={(e)=>setColor({...color,g:clamp(+e.target.value)})}/>
        <input type="number" className={`w-20 rounded-md border px-2 py-1 ${inputClass}`} value={color.b} onChange={(e)=>setColor({...color,b:clamp(+e.target.value)})}/>
      </div>
      <div className={`text-sm font-semibold ${labelClass}`}>HEX</div>
      <input type="text" className={`w-36 rounded-md border px-2 py-1 ${inputClass}`} value={rgbToHex(color)} onChange={(e)=>{ const rgb=hexToRgb(e.target.value); if(rgb) setColor(rgb); }}/>
      <div className={`text-sm font-semibold ${labelClass}`}>LRV</div>
      <LrvField color={color} setColor={setColor}/>
    </div>
  );

  return (
    <div className="grid gap-8 md:grid-cols-[1.2fr,0.8fr]">
      <div className="space-y-8">
        <div className="grid gap-8 md:grid-cols-3">
          <Editor title="Color A" color={colorA} setColor={setColorA} meta={metaA} setMeta={setMetaA}/>
          <Editor title="Color B" color={colorB} setColor={setColorB} meta={metaB} setMeta={setMetaB}/>
          <Editor title="Color C" color={colorC} setColor={setColorC} meta={metaC} setMeta={setMetaC}/>
        </div>
        <div className="space-y-6">
          <div>
            <div className={`text-sm font-semibold ${labelClass}`}>Blend A ↔ B</div>
            <div className="h-6 w-full rounded-full border" style={{background:`linear-gradient(90deg, ${rgbToHex(colorA)} 0%, ${rgbToHex(colorB)} 100%)`}}/>
            <input type="range" min={0} max={100} value={Math.round(tAB*100)} onChange={(e)=>setTAB(Number(e.target.value)/100)} className="w-full"/>
          </div>
          <div>
            <div className={`text-sm font-semibold ${labelClass}`}>Blend (AB) ↔ C</div>
            <div className="h-6 w-full rounded-full border" style={{background:`linear-gradient(90deg, ${rgbToHex(mix3(colorA,colorB,colorC,tAB,0))} 0%, ${rgbToHex(colorC)} 100%)`}}/>
            <input type="range" min={0} max={100} value={Math.round(tC*100)} onChange={(e)=>setTC(Number(e.target.value)/100)} className="w-full"/>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className={`text-lg font-bold ${labelClass}`}>Result</div>
        <div className="h-24 w-full rounded-xl border shadow-sm" style={{backgroundColor:rgbToHex(result)}}/>
        <div className="grid grid-cols-2 gap-3 text-sm items-center">
          <div className={`font-semibold ${labelClass}`}>HEX</div><div className={`font-mono ${textClass}`}>{rgbToHex(result)}</div>
          <div className={`font-semibold ${labelClass}`}>RGB</div><div className={`font-mono ${textClass}`}>{`${result.r}, ${result.g}, ${result.b}`}</div>
          <div className={`font-semibold ${labelClass}`}>LRV</div><div className={`font-mono ${textClass}`}>{lrv(result).toFixed(1)}</div>
          <div className={`font-semibold ${labelClass}`}>CIELAB</div><div className={`font-mono ${textClass}`}>{Object.values(rgbToLab(result)).map(n=>n.toFixed(1)).join(", ")}</div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------
// Shell: Pantry → choose 2 or 3 → route to correct mixer
// -------------------------------------------
export default function PantryRouterApp(){
  const [stage, setStage] = useState("pantry");
  const [picked, setPicked] = useState([]);

  const onMix = (chosen)=>{
    setPicked(chosen);
    setStage(chosen.length === 2 ? "mix2" : "mix3");
  };

  return (
    <div className={`mx-auto max-w-6xl p-6 ${bgClass}`}>
      <div className={`mb-4 text-2xl font-bold ${textClass}`}>Paint Pantry → Mixer</div>
      {stage === "pantry" && (
        <PantryPicker pantry={DEMO_PANTRY} onMix={onMix} />
      )}
      {stage === "mix2" && (
        <TwoColorMixer initialA={picked[0]} initialB={picked[1]} />
      )}
      {stage === "mix3" && (
        <ThreeColorMixer initialA={picked[0]} initialB={picked[1]} initialC={picked[2]} />
      )}
      {stage !== "pantry" && (
        <div className="mt-6">
          <button onClick={()=>setStage("pantry")} className="rounded-md border px-3 py-1">← Back to Pantry</button>
        </div>
      )}
    </div>
  );
}
