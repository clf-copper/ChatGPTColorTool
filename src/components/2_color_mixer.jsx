import React, { useMemo, useState, useRef, useEffect } from "react";
import paintColors from "../data/paintColors.json";

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

// RGB → Lab utilities
function rgbToXyz({ r, g, b }){
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = R*0.4124564 + G*0.3575761 + B*0.1804375;
  const Y = R*0.2126729 + G*0.7151522 + B*0.0721750;
  const Z = R*0.0193339 + G*0.1191920 + B*0.9503041;
  return { X, Y, Z };
}
function xyzToLab({ X, Y, Z }){
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  const f = (t)=> t > 216/24389 ? Math.cbrt(t) : (841/108)*t + 4/29;
  const fx=f(X/Xn), fy=f(Y/Yn), fz=f(Z/Zn);
  return { L:116*fy-16, a:500*(fx-fy), b:200*(fy-fz) };
}
const rgbToLab = (rgb)=> xyzToLab(rgbToXyz(rgb));

function labToXyz({ L, a, b }){
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const finv = (t)=> t>6/29 ? t*t*t : (108/841)*(t - 4/29);
  return { X: Xn * finv(fx), Y: Yn * finv(fy), Z: Zn * finv(fz) };
}
function xyzToRgb({ X, Y, Z }){
  let R =  3.2404542*X - 1.5371385*Y - 0.4985314*Z;
  let G = -0.9692660*X + 1.8760108*Y + 0.0415560*Z;
  let B =  0.0556434*X - 0.2040259*Y + 1.0572252*Z;
  const to8 = (v)=> clamp(Math.round(linearToSrgb(Math.max(0, Math.min(1, v)))*255));
  return { r: to8(R), g: to8(G), b: to8(B) };
}
const labToRgb = (lab)=> xyzToRgb(labToXyz(lab));

// Adjust a color to a target LRV
const clamp01 = (x)=>Math.max(0,Math.min(1,x));
const colorWithLRV = (col, targetLRV)=>{
  if (isNaN(targetLRV)) return col;
  const tgt = Math.max(0, Math.min(100, targetLRV));
  const Rt = srgbToLinear(col.r), Gt = srgbToLinear(col.g), Bt = srgbToLinear(col.b);
  const Y = 0.2126*Rt + 0.7152*Gt + 0.0722*Bt;
  const Ty = tgt/100;
  if (Y <= 1e-6) {
    const lin = clamp01(Ty);
    const to8 = v => clamp(Math.round(linearToSrgb(v)*255));
    return { r: to8(lin), g: to8(lin), b: to8(lin) };
  }
  const k = Ty / Y;
  const to8 = v => clamp(Math.round(linearToSrgb(v)*255));
  return { r: to8(clamp01(Rt*k)), g: to8(clamp01(Gt*k)), b: to8(clamp01(Bt*k)) };
};

// Linear-light mix for 2 colors
const mixRgb2 = (A, B, tB) => {
  const mixLinear = (x,y,t) => x*(1-t)+y*t;
  const fromLin = (c) => linearToSrgb(c)*255;
  const ch = (ca, cb) => clamp(Math.round(fromLin(mixLinear(srgbToLinear(ca), srgbToLinear(cb), tB))));
  return { r: ch(A.r, B.r), g: ch(A.g, B.g), b: ch(A.b, B.b) };
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
const Label = ({ children }) => (<label className={`block text-sm font-medium ${labelClass}`}>{children}</label>);
const NumberInput = ({ value, onChange, accent }) => (
  <input type="number" value={value} min={0} max={255} onChange={(e)=>onChange(Number(e.target.value))}
    className={`w-20 rounded-md border px-2 py-1 ${inputClass}`} style={usePreviewColors && accent ? { borderColor: accent } : undefined}/>
);
const HexInput = ({ value, onChange, accent }) => (
  <input type="text" value={value} onChange={(e)=>onChange(e.target.value)}
    className={`w-36 rounded-md border px-2 py-1 uppercase ${inputClass}`} placeholder="#RRGGBB"
    style={usePreviewColors && accent ? { borderColor: accent } : undefined}/>
);
const TextInput = ({ value, onChange, placeholder }) => (
  <input type="text" value={value} onChange={(e)=>onChange(e.target.value)}
    className={`w-full rounded-md border px-2 py-1 ${inputClass}`} placeholder={placeholder}/>
);
const VBar = ({ color }) => (<div className="h-40 w-5 rounded-lg border" style={{backgroundColor:color}}/>);
const Swatch = ({ color }) => (<div className="h-24 w-full rounded-xl border shadow-sm" style={{backgroundColor:color}}/>);

const Chip = ({ rgb, children }) => {
  const bg = rgbToHex(rgb);
  const fg = contrastText(rgb);
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold border"
      style={{ backgroundColor: usePreviewColors ? bg : undefined, color: usePreviewColors ? fg : undefined, borderColor: usePreviewColors ? bg : undefined }}>
      {children}
    </span>
  );
};

// ---------- Color Editor ----------
function ColorEditor({ title, color, setColor, meta, setMeta }) {
  const hex = rgbToHex(color);
  const onHexChange = (h) => {
    const rgb = hexToRgb(h);
    if (rgb) setColor(rgb);
  };
  const accent = usePreviewColors ? rgbToHex(color) : undefined;
  const lab = rgbToLab(color);

  return (
    <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 items-center">
      <div className="col-span-2 text-xl font-semibold text-black">{title}</div>

      {/* Manufacturer / Paint Type / Color Name */}
      <div className="col-span-2 grid grid-cols-1 gap-2 md:grid-cols-3">
        {/* Manufacturer dropdown */}
        <select
          value={meta.mfr}
          onChange={(e) => setMeta({ ...meta, mfr: e.target.value })}
          className={`rounded-md border px-2 py-1 ${inputClass}`}
        >
          <option value="">Select Manufacturer</option>
          {[...new Set(paintColors.map((c) => c.mfr))].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* Paint Type (free text for now) */}
        <input
          type="text"
          value={meta.type}
          onChange={(e) => setMeta({ ...meta, type: e.target.value })}
          placeholder="Paint Type (e.g., Eggshell)"
          className={`rounded-md border px-2 py-1 ${inputClass}`}
        />

        {/* Color Name/Code dropdown */}
        <select
          value={meta.name}
          onChange={(e) => {
            const chosen = paintColors.find((c) => c.code === e.target.value);
            if (chosen) {
              setMeta({ ...meta, name: chosen.name + " " + chosen.code, mfr: chosen.mfr });
              setColor(chosen.rgb); // auto-populate RGB
            }
          }}
          className={`rounded-md border px-2 py-1 ${inputClass}`}
        >
          <option value="">Select Color</option>
          {paintColors
            .filter((c) => !meta.mfr || c.mfr === meta.mfr)
            .map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
        </select>
      </div>

      {/* Vertical color bar */}
      <div className="row-span-6 flex items-center">
        <VBar color={rgbToHex(color)} />
      </div>

      {/* RGB inputs */}
      <div className={`text-sm font-semibold ${labelClass}`}>RGB</div>
      <div className={`flex gap-2 font-medium ${textClass}`}>
        <NumberInput value={color.r} onChange={(v) => setColor({ ...color, r: clamp(v) })} accent={accent} />
        <NumberInput value={color.g} onChange={(v) => setColor({ ...color, g: clamp(v) })} accent={accent} />
        <NumberInput value={color.b} onChange={(v) => setColor({ ...color, b: clamp(v) })} accent={accent} />
      </div>

      {/* HEX input */}
      <div className={`text-sm font-semibold ${labelClass}`}>HEX</div>
      <HexInput value={hex} onChange={onHexChange} accent={accent} />

      {/* LRV input */}
      <div className={`text-sm font-semibold ${labelClass}`}>LRV</div>
      <input
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={Number(lrv(color).toFixed(1))}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) setColor(colorWithLRV(color, v));
        }}
        className={`w-24 rounded-md border px-2 py-1 ${inputClass}`}
      />

      {/* CIELAB inputs */}
      <div className={`text-sm font-semibold ${labelClass}`}>CIELAB</div>
      <div className={`flex flex-wrap items-center gap-2 ${textClass}`}>
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={Number(lab.L.toFixed(1))}
          onChange={(e) => {
            const L = parseFloat(e.target.value);
            if (!Number.isNaN(L)) setColor(labToRgb({ L, a: lab.a, b: lab.b }));
          }}
          className={`w-20 rounded-md border px-2 py-1 ${inputClass}`}
          placeholder="L"
        />
        <input
          type="number"
          min={-128}
          max={128}
          step={0.1}
          value={Number(lab.a.toFixed(1))}
          onChange={(e) => {
            const a = parseFloat(e.target.value);
            if (!Number.isNaN(a)) setColor(labToRgb({ L: lab.L, a, b: lab.b }));
          }}
          className={`w-20 rounded-md border px-2 py-1 ${inputClass}`}
          placeholder="a"
        />
        <input
          type="number"
          min={-128}
          max={128}
          step={0.1}
          value={Number(lab.b.toFixed(1))}
          onChange={(e) => {
            const b = parseFloat(e.target.value);
            if (!Number.isNaN(b)) setColor(labToRgb({ L: lab.L, a: lab.a, b }));
          }}
          className={`w-20 rounded-md border px-2 py-1 ${inputClass}`}
          placeholder="b"
        />
      </div>
    </div>
  );
}

// ---------- Result Panel ----------
function ResultPanel({ result, tB, colors }) {
  const resultHex = rgbToHex(result);
  const pctB = Math.round(tB * 100);
  const pctA = 100 - pctB;
  const lab = rgbToLab(result);
  return (
    <div className="space-y-4">
      <div className={`text-lg font-bold ${textClass}`}>Result</div>
      <Swatch color={resultHex} />
      <div className="grid grid-cols-2 gap-3 text-sm items-center">
        <div className={`font-semibold ${labelClass}`}>HEX</div><div className={`font-mono ${textClass}`}>{resultHex}</div>
        <div className={`font-semibold ${labelClass}`}>RGB</div><div className={`font-mono ${textClass}`}>{`${result.r}, ${result.g}, ${result.b}`}</div>
        <div className={`font-semibold ${labelClass}`}>LRV</div><div className={`font-mono ${textClass}`}>{lrv(result).toFixed(1)}</div>
        <div className={`font-semibold ${labelClass}`}>CIELAB</div><div className={`font-mono ${textClass}`}>{`${lab.L.toFixed(1)}, ${lab.a.toFixed(1)}, ${lab.b.toFixed(1)}`}</div>
        <div className={`font-semibold ${labelClass}`}>Mix Ratio</div>
        <div className="flex flex-wrap gap-2">
          <Chip rgb={colors[0]}>{`${pctA}% A`}</Chip>
          <span className={`${textClass}`}>:</span>
          <Chip rgb={colors[1]}>{`${pctB}% B`}</Chip>
        </div>
      </div>
    </div>
  );
}

// ---------- Blend Controls ----------
function BlendControls({ colorA, colorB, tB, setTB }) {
  const grad = `linear-gradient(90deg, ${rgbToHex(colorA)} 0%, ${rgbToHex(colorB)} 100%)`;
  return (
    <div className="space-y-4">
      <div className={`text-sm font-semibold ${textClass}`}>Blend A ↔ B</div>
      <div className="h-6 w-full rounded-full border" style={{ background: grad }} />
      <input type="range" min={0} max={100} value={Math.round(tB * 100)}
        onChange={(e) => setTB(Number(e.target.value) / 100)} className="w-full"/>
      <div className="flex justify-between text-xs opacity-70">
        <span>More A</span>
        <span>More B</span>
      </div>
    </div>
  );
}

    // ---------- Square Blend Visualizer (2-color) ----------
function SquareBlendVisualizer2({ colorA, colorB, onChange, useDarkMode }) {
  const canvasRef = useRef(null);
  const [pointer, setPointer] = useState(null);
  const size = 300;
  const radius = size * 0.46;
  const cx = size / 2, cy = size / 2;
  const A = { x: size * 0.12, y: cy };
  const B = { x: size * 0.88, y: cy };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d");
    canvas.width = size; canvas.height = size;
    ctx.fillStyle = useDarkMode ? "#111" : "#fafafa"; ctx.fillRect(0,0,size,size);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.clip();
    const grad = ctx.createLinearGradient(A.x, cy, B.x, cy);
    grad.addColorStop(0, rgbToHex(colorA));
    grad.addColorStop(1, rgbToHex(colorB));
    ctx.fillStyle = grad; ctx.fillRect(0,0,size,size);
    ctx.restore();
    const draw=(pt,col)=>{ ctx.beginPath(); ctx.arc(pt.x,pt.y,10,0,Math.PI*2); ctx.fillStyle=rgbToHex(col); ctx.fill(); ctx.strokeStyle="#000"; ctx.lineWidth=1.5; ctx.stroke(); };
    draw(A,colorA); draw(B,colorB);
    if (pointer) { ctx.beginPath(); ctx.arc(pointer.x,pointer.y,7,0,Math.PI*2); ctx.fillStyle="#fff"; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle=useDarkMode?"#fff":"#000"; ctx.stroke(); }
  }, [colorA, colorB, pointer, useDarkMode]);

  const update=(clientX, clientY)=>{
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left; const y = clientY - rect.top;
    const dx=x-cx, dy=y-cy; if (dx*dx+dy*dy > radius*radius) return;
    const tB = Math.min(1, Math.max(0, (x - (cx - radius)) / (2*radius)));
    setPointer({ x, y });
    onChange(tB);
  };

  return (
    <div className="space-y-2">
      <div className={`text-sm font-semibold ${textClass}`}>Square Visualizer</div>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="border rounded select-none cursor-crosshair"
        onMouseDown={(e)=>update(e.clientX,e.clientY)}
        onMouseMove={(e)=>{ if(e.buttons===1) update(e.clientX,e.clientY); }}
      />
      <div className="text-xs opacity-70">Click/drag inside the circle. Pointer marks selection and updates the result.</div>
    </div>
  );
}

// ---------- Page Shell ----------
export default function TwoColorMixer({ initialA, initialB }) {
  const [colorA, setColorA] = useState(initialA?.rgb || { r: 236, g: 231, b: 222 });
  const [colorB, setColorB] = useState(initialB?.rgb || { r: 214, g: 200, b: 183 });
  const [banner, setBanner] = useState(null);
  const [tB, setTB] = useState(0.5);

  // Optional pantry (provide your own array or set window.__PAINT_PANTRY__ elsewhere)
  const PANTRY =
    typeof window !== "undefined" && window.__PAINT_PANTRY__
      ? window.__PAINT_PANTRY__
      : [];

  const result = useMemo(
    () => mixRgb2(colorA, colorB, tB),
    [colorA, colorB, tB]
  );

  return (
    <div className={`mx-auto max-w-6xl p-6 ${bgClass}`}>
      <div className={`mb-4 text-2xl font-bold ${textClass}`}>Color Mixer — 2-Color Section</div>

      {banner && (<div className={`mb-4 rounded-md border px-3 py-2 ${
          banner.kind==='ok' ? 'border-green-400' :
          banner.kind==='warn' ? 'border-amber-400' : 'border-slate-300'}`}>
          <div className="text-sm">{banner.text}</div>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-8">
          <div className="grid gap-8 md:grid-cols-2">
            <ColorEditor title="Color A" color={colorA} setColor={setColorA}/>
            <ColorEditor title="Color B" color={colorB} setColor={setColorB}/>
          </div>

          {/* NEW: Target CIELAB → Solve B */}
          <TargetLabSolver colorA={colorA} tB={tB} setColorB={setColorB} pantry={PANTRY} setBanner={setBanner} />

          <BlendControls colorA={colorA} colorB={colorB} tB={tB} setTB={setTB}/>
          <SquareBlendVisualizer2 colorA={colorA} colorB={colorB} onChange={setTB} useDarkMode={useDarkMode}/>
        </div>
        <ResultPanel result={result} tB={tB} colors={[colorA, colorB]}/>
      </div>
    </div>
  );
}
