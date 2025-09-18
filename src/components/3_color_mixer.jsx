import React, { useMemo, useState, useRef, useEffect } from "react";

// Toggle between light and dark preview modes
const useDarkMode = false;
const usePreviewColors = true;

// ---------- Utilities ----------
const clamp = (n, min = 0, max = 255) => Math.min(max, Math.max(min, n));
const toHex = (v) => clamp(Math.round(v)).toString(16).padStart(2, "0").toUpperCase();
const rgbToHex = ({ r, g, b }) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;
const hexToRgb = (hex) => {
  const h = hex.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
  if (h.length !== 6) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
};
const srgbToLinear = (c) => { c = c / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const linearToSrgb = (c) => { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
const lrv = ({ r, g, b }) => { const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b); const Y = 0.2126*R+0.7152*G+0.0722*B; return Math.round(Y*1000)/10; };

// --- RGB <-> CIELAB ---
const rgbToXyz = ({ r, g, b }) => {
  // normalize
  r = srgbToLinear(r); g = srgbToLinear(g); b = srgbToLinear(b);
  // D65 standard
  return {
    x: (r*0.4124564 + g*0.3575761 + b*0.1804375) / 0.95047,
    y: (r*0.2126729 + g*0.7151522 + b*0.0721750) / 1.00000,
    z: (r*0.0193339 + g*0.1191920 + b*0.9503041) / 1.08883,
  };
};

const xyzToLab = ({ x, y, z }) => {
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787*t + 16/116);
  const fx = f(x), fy = f(y), fz = f(z);
  return {
    L: 116*fy - 16,
    a: 500*(fx - fy),
    b: 200*(fy - fz),
  };
};

const labToXyz = ({ L, a, b }) => {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const f3 = (t) => (t**3 > 0.008856 ? t**3 : (t - 16/116) / 7.787);
  return {
    x: f3(fx) * 0.95047,
    y: f3(fy) * 1.00000,
    z: f3(fz) * 1.08883,
  };
};

const xyzToRgb = ({ x, y, z }) => {
  let r = x* 3.2404542 + y*-1.5371385 + z*-0.4985314;
  let g = x*-0.9692660 + y* 1.8760108 + z* 0.0415560;
  let b = x* 0.0556434 + y*-0.2040259 + z* 1.0572252;
  const to8 = (c) => clamp(Math.round(linearToSrgb(c)*255));
  return { r: to8(r), g: to8(g), b: to8(b) };
};

const rgbToLab = (rgb) => xyzToLab(rgbToXyz(rgb));
const labToRgb = (lab) => xyzToRgb(labToXyz(lab));

// --- LRV setter utilities ---
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const colorWithLRV = (col, targetLRV) => {
  const tgt = Math.max(0, Math.min(100, Number(targetLRV)));
  const Rt = srgbToLinear(col.r), Gt = srgbToLinear(col.g), Bt = srgbToLinear(col.b);
  const Y  = 0.2126*Rt + 0.7152*Gt + 0.0722*Bt;
  const Ty = tgt/100;
  if (Y <= 1e-6) {
    const lin = clamp01(Ty);
    const to8 = (v) => clamp(Math.round(linearToSrgb(v)*255));
    return { r: to8(lin), g: to8(lin), b: to8(lin) };
  }
  const k = Ty / Y;
  const to8 = (v) => clamp(Math.round(linearToSrgb(v)*255));
  const rlin = clamp01(Rt*k), glin = clamp01(Gt*k), blin = clamp01(Bt*k);
  return { r: to8(rlin), g: to8(glin), b: to8(blin) };
};

// Linear-light mix for 3 colors
const mixRgb3 = (A, B, C, tAB, tC) => {
  const mixLinear = (x,y,t) => x*(1-t)+y*t;
  const fromLin = (c) => linearToSrgb(c)*255;
  const mixChannel = (ca,cb,cc) => {
    const ab = mixLinear(srgbToLinear(ca), srgbToLinear(cb), tAB);
    const abc = mixLinear(ab, srgbToLinear(cc), tC);
    return clamp(Math.round(fromLin(abc)));
  };
  return { r: mixChannel(A.r,B.r,C.r), g: mixChannel(A.g,B.g,C.g), b: mixChannel(A.b,B.b,C.b) };
};

// ---------- Theme Helpers ----------
const textClass = useDarkMode ? "text-white" : "text-gray-900";
const labelClass = useDarkMode ? "text-white" : "text-gray-800";
const inputClass = useDarkMode ? "bg-black text-white" : "bg-white text-black";
const bgClass = useDarkMode ? "bg-black" : "bg-white";

const contrastText = (rgb) => {
  const Y = 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
  return Y > 0.5 ? "#000" : "#FFF";
};

// ---------- Small UI atoms ----------
const NumberInput = ({ value, onChange, accent }) => (
  <input
    type="number"
    value={value}
    min={0}
    max={255}
    onChange={(e)=>onChange(Number(e.target.value))}
    className={`w-20 rounded-md border px-2 py-1 ${inputClass}`}
    style={usePreviewColors && accent ? { borderColor: accent } : undefined}
  />
);
const HexInput = ({ value, onChange, accent }) => (
  <input
    type="text"
    value={value}
    onChange={(e)=>onChange(e.target.value)}
    className={`w-36 rounded-md border px-2 py-1 uppercase ${inputClass}`}
    placeholder="#RRGGBB"
    style={usePreviewColors && accent ? { borderColor: accent } : undefined}
  />
);
const TextInput = ({ value, onChange, placeholder }) => (
  <input
    type="text"
    value={value}
    onChange={(e)=>onChange(e.target.value)}
    className={`w-full rounded-md border px-2 py-1 ${inputClass}`}
    placeholder={placeholder}
  />
);
const VBar = ({ color }) => (<div className="h-40 w-5 rounded-lg border" style={{backgroundColor:color}}/>);
const Swatch = ({ color }) => (<div className="h-24 w-full rounded-xl border shadow-sm" style={{backgroundColor:color}}/>);

const Chip = ({ rgb, children }) => {
  const bg = rgbToHex(rgb);
  const fg = contrastText(rgb);
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold border"
      style={{ backgroundColor: usePreviewColors ? bg : undefined, color: usePreviewColors ? fg : undefined, borderColor: usePreviewColors ? bg : undefined }}
    >
      {children}
    </span>
  );
};

// ---------- Color Editor ----------
function ColorEditor({ title, color, setColor }) {
  const hex = rgbToHex(color);
  const onHexChange = (h) => { const rgb = hexToRgb(h); if(rgb) setColor(rgb); };
  const accent = usePreviewColors ? rgbToHex(color) : undefined;
  const [mfr, setMfr] = useState("");
  const [ptype, setPtype] = useState("");
  const [cname, setCname] = useState("");
  return (
    <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 items-center">
      <div className="col-span-2 text-xl font-semibold text-black">{title}</div>
      {/* Manufacturer / Paint Type / Color Name */}
      <div className="col-span-2 grid grid-cols-1 gap-2 md:grid-cols-3">
        <TextInput value={mfr} onChange={setMfr} placeholder="Manufacturer" />
        <TextInput value={ptype} onChange={setPtype} placeholder="Paint Type (e.g., Eggshell)" />
        <TextInput value={cname} onChange={setCname} placeholder="Color Name / Code" />
      </div>
      <div className="row-span-4 flex items-center"><VBar color={rgbToHex(color)} /></div>
      <div className={`text-sm font-semibold ${labelClass}`}>RGB</div>
      <div className={`flex gap-2 font-medium ${textClass}`}>
        <NumberInput value={color.r} onChange={(v)=>setColor({...color,r:clamp(v)})} accent={accent}/>
        <NumberInput value={color.g} onChange={(v)=>setColor({...color,g:clamp(v)})} accent={accent}/>
        <NumberInput value={color.b} onChange={(v)=>setColor({...color,b:clamp(v)})} accent={accent}/>
      </div>
      <div className={`text-sm font-semibold ${labelClass}`}>HEX</div>
      <HexInput value={hex} onChange={onHexChange} accent={accent}/>
      <div className={`text-sm font-semibold ${labelClass}`}>LRV</div>
      <input
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={Number(lrv(color).toFixed(1))}
        onChange={(e)=>{ const v = parseFloat(e.target.value); if(!Number.isNaN(v)) setColor(colorWithLRV(color, v)); }}
        className={`w-24 rounded-md border px-2 py-1 ${inputClass}`}
        />

    <div className={`text-sm font-semibold ${labelClass}`}>CIELAB</div>
    <div className={`flex gap-2 font-medium ${textClass}`}>
  {(() => {
    const lab = rgbToLab(color);
    return (
      <>
        <NumberInput
          value={lab.L.toFixed(1)}
          onChange={(v)=>setColor(labToRgb({ ...lab, L:v }))}
          accent={accent}/>
        <NumberInput
          value={lab.a.toFixed(1)}
          onChange={(v)=>setColor(labToRgb({ ...lab, a:v }))}
          accent={accent}/>
        <NumberInput
          value={lab.b.toFixed(1)}
          onChange={(v)=>setColor(labToRgb({ ...lab, b:v }))}
          accent={accent}/>
       </>
     );
   })()}
 </div>

// ---------- Result Panel ----------
function ResultPanel({ result, tAB, tC, colors }) {
  const [override, setOverride] = useState(null); // manual edits
  const activeResult = override || result;
  const resultHex = rgbToHex(activeResult);

  const pctA = Math.round((1 - tAB) * (1 - tC) * 100);
  const pctB = Math.round(tAB * (1 - tC) * 100);
  const pctC = Math.round(tC * 100);

  return (
    <div className="space-y-4">
      <div className={`text-lg font-bold ${textClass}`}>Result</div>
      <div className="flex items-center gap-2">
        <Swatch color={resultHex} />
        {override && <button onClick={()=>setOverride(null)} className="px-3 py-1 rounded-md border text-sm font-medium hover:bg-gray-100"
                       >Reset</button>}</div>

      <div className="grid grid-cols-2 gap-3 text-sm items-center">
        {/* HEX */}
        <div className={`font-semibold ${labelClass}`}>HEX</div>
        <HexInput
          value={rgbToHex(activeResult)}
          onChange={(h) => {
            const rgb = hexToRgb(h);
            if (rgb) setOverride(rgb);
          }}
          accent={resultHex}
        />

        {/* RGB */}
        <div className={`font-semibold ${labelClass}`}>RGB</div>
        <div className={`flex gap-2 font-medium ${textClass}`}>
          <NumberInput value={activeResult.r} onChange={(v)=>setOverride({ ...activeResult, r: clamp(v) })} accent={resultHex}/>
          <NumberInput value={activeResult.g} onChange={(v)=>setOverride({ ...activeResult, g: clamp(v) })} accent={resultHex}/>
          <NumberInput value={activeResult.b} onChange={(v)=>setOverride({ ...activeResult, b: clamp(v) })} accent={resultHex}/>
        </div>

        {/* LRV */}
        <div className={`font-semibold ${labelClass}`}>LRV</div>
        <NumberInput
          value={lrv(activeResult).toFixed(1)}
          onChange={(v)=>setOverride(colorWithLRV(activeResult, v))}
          accent={resultHex}
        />

        {/* CIELAB */}
        <div className={`font-semibold ${labelClass}`}>CIELAB</div>
        <div className={`flex gap-2 font-medium ${textClass}`}>
          {(() => {
            const lab = rgbToLab(activeResult);
            return (
              <>
                <NumberInput value={lab.L.toFixed(1)} onChange={(v)=>setOverride(labToRgb({ ...lab, L:v }))} accent={resultHex}/>
                <NumberInput value={lab.a.toFixed(1)} onChange={(v)=>setOverride(labToRgb({ ...lab, a:v }))} accent={resultHex}/>
                <NumberInput value={lab.b.toFixed(1)} onChange={(v)=>setOverride(labToRgb({ ...lab, b:v }))} accent={resultHex}/>
              </>
            );
          })()}
        </div>

        {/* Mix Ratio */}
        <div className={`font-semibold ${labelClass}`}>Mix Ratio</div>
        <div className="flex flex-wrap gap-2">
          <Chip rgb={colors[0]}>{`${pctA}% A`}</Chip>
          <span className={`${textClass}`}>:</span>
          <Chip rgb={colors[1]}>{`${pctB}% B`}</Chip>
          <span className={`${textClass}`}>:</span>
          <Chip rgb={colors[2]}>{`${pctC}% C`}</Chip>
        </div>
      </div>
    </div>
  );
}

// ---------- Blend Controls ----------
function BlendControls({ colorA,colorB,colorC,tAB,setTAB,tC,setTC }) {
  const gradAB = `linear-gradient(90deg, ${rgbToHex(colorA)} 0%, ${rgbToHex(colorB)} 100%)`;
  const blendAB = mixRgb3(colorA,colorB,colorC,tAB,0);
  const gradABC = `linear-gradient(90deg, ${rgbToHex(blendAB)} 0%, ${rgbToHex(colorC)} 100%)`;
  return (
    <div className="space-y-6">
      <div>
        <div className={`text-sm font-semibold ${textClass}`}>Blend A ↔ B</div>
        <div className="h-6 w-full rounded-full border" style={{background:gradAB}}/>
        <input type="range" min={0} max={100} value={Math.round(tAB*100)} onChange={(e)=>setTAB(Number(e.target.value)/100)} className="w-full"/>
      </div>
      <div>
        <div className={`text-sm font-semibold ${textClass}`}>Blend (AB) ↔ C</div>
        <div className="h-6 w-full rounded-full border" style={{background:gradABC}}/>
        <input type="range" min={0} max={100} value={Math.round(tC*100)} onChange={(e)=>setTC(Number(e.target.value)/100)} className="w-full"/>
      </div>
    </div>
  );
}

// ---------- Square Visualizer (3‑color) ----------
function SquareBlendVisualizer({ colorA, colorB, colorC, onWeightsChange, useDarkMode }) {
  const canvasRef = useRef(null);
  const [pointer, setPointer] = useState(null);
  const size = 300; // large square
  const radius = size * 0.46; // circle inside
  const cx = size / 2, cy = size / 2;
  // anchors: A top-left, B top-right, C bottom-center
  const A = { x: size * 0.12, y: size * 0.12 };
  const B = { x: size * 0.88, y: size * 0.12 };
  const C = { x: size * 0.50, y: size * 0.88 };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d");
    canvas.width = size; canvas.height = size;
    ctx.fillStyle = useDarkMode ? "#111" : "#fafafa"; ctx.fillRect(0,0,size,size);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.clip();
    const img = ctx.createImageData(size, size);
    for (let y=0; y<size; y++) {
      for (let x=0; x<size; x++) {
        const dx=x-cx, dy=y-cy; if (dx*dx+dy*dy > radius*radius) continue;
        const dA=Math.hypot(x-A.x,y-A.y)||1e-6, dB=Math.hypot(x-B.x,y-B.y)||1e-6, dC=Math.hypot(x-C.x,y-C.y)||1e-6;
        const p=2.0; const wA=1/Math.pow(dA,p), wB=1/Math.pow(dB,p), wC=1/Math.pow(dC,p); const W=wA+wB+wC;
        const r=(wA*colorA.r+wB*colorB.r+wC*colorC.r)/W, g=(wA*colorA.g+wB*colorB.g+wC*colorC.g)/W, b=(wA*colorA.b+wB*colorB.b+wC*colorC.b)/W;
        const i=(y*size+x)*4; img.data[i]=r; img.data[i+1]=g; img.data[i+2]=b; img.data[i+3]=255;
      }
    }
    ctx.putImageData(img,0,0); ctx.restore();
    const draw=(pt,col)=>{ ctx.beginPath(); ctx.arc(pt.x,pt.y,10,0,Math.PI*2); ctx.fillStyle=rgbToHex(col); ctx.fill(); ctx.strokeStyle="#000"; ctx.lineWidth=1.5; ctx.stroke(); };
    draw(A,colorA); draw(B,colorB); draw(C,colorC);
    if (pointer) { ctx.beginPath(); ctx.arc(pointer.x,pointer.y,7,0,Math.PI*2); ctx.fillStyle="#fff"; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle=useDarkMode?"#fff":"#000"; ctx.stroke(); }
  }, [colorA,colorB,colorC,pointer,useDarkMode]);

  const update=(clientX, clientY)=>{
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left; const y = clientY - rect.top;
    const dx=x-cx, dy=y-cy; if (dx*dx+dy*dy > radius*radius) return;
    const dA=Math.hypot(x-A.x,y-A.y)||1e-6, dB=Math.hypot(x-B.x,y-B.y)||1e-6, dC=Math.hypot(x-C.x,y-C.y)||1e-6;
    const p=2.0; let wA=1/Math.pow(dA,p), wB=1/Math.pow(dB,p), wC=1/Math.pow(dC,p); const W=wA+wB+wC; wA/=W; wB/=W; wC/=W;
    setPointer({ x, y });
    onWeightsChange({ a:wA, b:wB, c:wC });
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Square Visualizer</div>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="border rounded select-none cursor-crosshair"
        onMouseDown={(e)=>update(e.clientX,e.clientY)}
        onMouseMove={(e)=>{ if(e.buttons===1) update(e.clientX,e.clientY); }}
      />
      <div className="text-xs opacity-70">Click/drag inside the circle to choose a blend. Pointer marks selection.</div>
    </div>
  );
}

// ---------- Page Shell ----------
export default function ThreeColorMixer() {
  const [colorA,setColorA] = useState({r:236,g:231,b:222});
  const [colorB,setColorB] = useState({r:214,g:200,b:183});
  const [colorC,setColorC] = useState({r:180,g:170,b:160});
  const [tAB,setTAB] = useState(0.5);
  const [tC,setTC] = useState(0.5);

  const handleWeights = ({a,b,c})=>{
    const tCnew = c;
    const denom = a + b;
    const tABnew = denom > 1e-6 ? b / denom : 0.5;
    setTAB(tABnew); setTC(tCnew);
  };

  const result = useMemo(()=>mixRgb3(colorA,colorB,colorC,tAB,tC),[colorA,colorB,colorC,tAB,tC]);

  return (
    <div className={`mx-auto max-w-6xl p-6 ${bgClass}`}>
      <div className={`mb-4 text-2xl font-bold ${textClass}`}>Color Mixer — 3-Color Section</div>
      <div className="grid gap-8 md:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-8">
          <div className="grid gap-8 md:grid-cols-3">
            <ColorEditor title="Color A" color={colorA} setColor={setColorA}/>
            <ColorEditor title="Color B" color={colorB} setColor={setColorB}/>
            <ColorEditor title="Color C" color={colorC} setColor={setColorC}/>
          </div>
          <BlendControls colorA={colorA} colorB={colorB} colorC={colorC} tAB={tAB} setTAB={setTAB} tC={tC} setTC={setTC}/>
          <SquareBlendVisualizer colorA={colorA} colorB={colorB} colorC={colorC} onWeightsChange={handleWeights} useDarkMode={useDarkMode}/>
        </div>
        <ResultPanel result={result} tAB={tAB} tC={tC} colors={[colorA,colorB,colorC]}/>
      </div>
    </div>
  );
}
