import React, { useState } from "react";

// --- Helper functions for color conversions ---
// Convert RGB to XYZ
const rgbToXyz = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  let x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  let z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  return [x * 100, y * 100, z * 100];
};

// Convert XYZ to Lab
const xyzToLab = (x, y, z) => {
  const refX = 95.047, refY = 100.0, refZ = 108.883;
  x /= refX; y /= refY; z /= refZ;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116);
  let fx = f(x), fy = f(y), fz = f(z);
  let L = (116 * fy) - 16;
  let a = 500 * (fx - fy);
  let b = 200 * (fy - fz);
  return [L.toFixed(2), a.toFixed(2), b.toFixed(2)];
};

// Convert RGB → Lab
const rgbToLab = (r, g, b) => {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
};

const TwoColorMixer = () => {
  const [colorA, setColorA] = useState("#ff0000");
  const [colorB, setColorB] = useState("#0000ff");
  const [labA, setLabA] = useState("");
  const [labB, setLabB] = useState("");
  const [ratio, setRatio] = useState(50);

  // Function to convert hex → RGB
  const hexToRgb = hex => {
    let bigint = parseInt(hex.slice(1), 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    return [r, g, b];
  };

  // Mixed color calculation
  const mixColors = () => {
    const [rA, gA, bA] = hexToRgb(colorA);
    const [rB, gB, bB] = hexToRgb(colorB);
    const r = Math.round((rA * (100 - ratio) + rB * ratio) / 100);
    const g = Math.round((gA * (100 - ratio) + gB * ratio) / 100);
    const b = Math.round((bA * (100 - ratio) + bB * ratio) / 100);
    return [r, g, b];
  };

  const [r, g, b] = mixColors();
  const mixedHex = `#${((1 << 24) + (r << 16) + (g << 8) + b)
    .toString(16)
    .slice(1)}`;

  // Convert inputs + mixed result to Lab
  const labValA = rgbToLab(...hexToRgb(colorA));
  const labValB = rgbToLab(...hexToRgb(colorB));
  const labMixed = rgbToLab(r, g, b);

  return (
    <div style={{ padding: "20px" }}>
      <h2>2-Color Mixer</h2>

      <div>
        <label>Color A: </label>
        <input type="color" value={colorA} onChange={e => setColorA(e.target.value)} />
        <input type="text" value={labA} placeholder="Enter CIELAB (L,a,b)" 
          onChange={e => setLabA(e.target.value)} style={{ marginLeft: "10px" }} />
        <div>RGB: {hexToRgb(colorA).join(", ")} | Lab: {labValA.join(", ")}</div>
      </div>

      <div>
        <label>Color B: </label>
        <input type="color" value={colorB} onChange={e => setColorB(e.target.value)} />
        <input type="text" value={labB} placeholder="Enter CIELAB (L,a,b)" 
          onChange={e => setLabB(e.target.value)} style={{ marginLeft: "10px" }} />
        <div>RGB: {hexToRgb(colorB).join(", ")} | Lab: {labValB.join(", ")}</div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <label>Mix Ratio: {ratio}%</label>
        <input type="range" min="0" max="100" value={ratio} 
          onChange={e => setRatio(Number(e.target.value))} />
      </div>

      <div style={{ marginTop: "20px" }}>
        <div style={{ background: mixedHex, width: "100px", height: "100px" }} />
        <p>Mixed RGB: {r}, {g}, {b}</p>
        <p>Mixed HEX: {mixedHex}</p>
        <p>Mixed Lab: {labMixed.join(", ")}</p>
      </div>
    </div>
  );
};

export default TwoColorMixer;

