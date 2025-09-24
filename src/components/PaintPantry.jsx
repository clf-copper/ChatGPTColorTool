import React, { useState, useEffect } from "react";
import paintColors from "../data/paintColors.json";

export default function PaintPantry({ onSelectPaint }) {
  const [paints, setPaints] = useState([]);
  const [formData, setFormData] = useState({
    r: "",
    g: "",
    b: "",
    hex: "",
    cielab: "",
    lrv: "",
    type: "",
    sheen: "",
    location: "",
    opacity: "",
    mfr: "",
    name: "",
    volume: "",
    unit: "gal",
    base: "", // water-based, oil/alkyd, waterborne alkyd
  });

  const sheenOptions = ["Flat", "Matte", "Eggshell", "Satin", "Semi-Gloss", "Gloss", "Other"];
  const typeOptions = ["Latex", "Acrylic Enamel", "Alkyd Enamel", "Lacquer", "Stain", "Primer"];
  const locationOptions = ["Interior", "Exterior"];
  const opacityOptions = ["Clear", "Toner", "Semi-Transparent", "Semi-Solid", "Solid"];
  const unitOptions = ["oz", "pt", "qt", "gal", "L"];
  const baseOptions = ["Water-Based", "Oil/Alkyd", "Waterborne Alkyd"];

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("paintPantry");
    if (stored) setPaints(JSON.parse(stored));
  }, []);

  // Save to localStorage whenever paints change
  useEffect(() => {
    localStorage.setItem("paintPantry", JSON.stringify(paints));
  }, [paints]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addPaint = (e) => {
    e.preventDefault();
    if (!formData.hex || !formData.name) return; // Require at least hex + name
    setPaints([...paints, formData]);
    setFormData({
      r: "",
      g: "",
      b: "",
      hex: "",
      cielab: "",
      lrv: "",
      type: "",
      sheen: "",
      location: "",
      opacity: "",
      mfr: "",
      name: "",
      volume: "",
      unit: "gal",
      base: "",
    });
  };

  const removePaint = (index) => {
    const updated = paints.filter((_, i) => i !== index);
    setPaints(updated);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold mb-4">🎨 Paint Pantry</h2>

      {/* Add Paint Form */}
      <form
        onSubmit={addPaint}
        className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-100 p-4 rounded-lg shadow"
      >
        <input name="r" placeholder="R" value={formData.r} onChange={handleChange} className="border p-2 rounded" />
        <input name="g" placeholder="G" value={formData.g} onChange={handleChange} className="border p-2 rounded" />
        <input name="b" placeholder="B" value={formData.b} onChange={handleChange} className="border p-2 rounded" />
        <input name="hex" placeholder="HEX" value={formData.hex} onChange={handleChange} className="border p-2 rounded" />
        <input name="cielab" placeholder="CIELAB" value={formData.cielab} onChange={handleChange} className="border p-2 rounded" />
        <input name="lrv" placeholder="LRV" value={formData.lrv} onChange={handleChange} className="border p-2 rounded" />

        <select name="type" value={formData.type} onChange={handleChange} className="border p-2 rounded">
          <option value="">Select Paint Type</option>
          {typeOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <select name="sheen" value={formData.sheen} onChange={handleChange} className="border p-2 rounded">
          <option value="">Select Sheen</option>
          {sheenOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <select name="location" value={formData.location} onChange={handleChange} className="border p-2 rounded">
          <option value="">Select Location</option>
          {locationOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <select name="opacity" value={formData.opacity} onChange={handleChange} className="border p-2 rounded">
          <option value="">Select Opacity</option>
          {opacityOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <select name="base" value={formData.base} onChange={handleChange} className="border p-2 rounded">
          <option value="">Select Base</option>
          {baseOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        
        {/* Manufacturer dropdown */}
        <select
          name="mfr"
          value={formData.mfr}
          onChange={handleChange}
          className="border p-2 rounded"
          >
          <option value="">Select Manufacturer</option>
          {[...new Set(paintColors.map(c => c.mfr))].map(m => (
            <option key={m} value={m}>{m}</option>))}
        </select>
        
        {/* Paint Type (free text for now) */}
        <input
          type="text"
          name="type"
          value={formData.type}
          onChange={handleChange}
          placeholder="Paint Type (e.g., Eggshell)"
          className="border p-2 rounded"
          />
        
        {/* Color Name/Code dropdown */}
        <select
          name="name"
          value={formData.name}
          onChange={(e) => {
            const chosen = paintColors.find(c => c.code === e.target.value);
            if (chosen) {setFormData({...formData,
                                      name: chosen.name + " " + chosen.code,
                                      mfr: chosen.mfr,
                                      r: chosen.rgb.r,
                                      g: chosen.rgb.g,
                                      b: chosen.rgb.b,
                                      hex: chosen.hex,
                                      lrv: chosen.lrv
                                     });
                        }
          }}
          className="border p-2 rounded"
          >
          <option value="">Select Color</option>
          {paintColors
            .filter(c => !formData.mfr || c.mfr === formData.mfr)
            .map(c => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
        </select>

        <div className="flex col-span-2 md:col-span-1">
          <input name="volume" placeholder="Volume" value={formData.volume} onChange={handleChange} className="border p-2 rounded w-2/3" />
          <select name="unit" value={formData.unit} onChange={handleChange} className="border p-2 rounded w-1/3">
            {unitOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="col-span-2 md:col-span-3 bg-blue-600 text-white rounded p-2 hover:bg-blue-700">
          Add Paint
        </button>
      </form>

      {/* Pantry List */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-2 py-1">Color</th>
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">MFR</th>
              <th className="border px-2 py-1">HEX</th>
              <th className="border px-2 py-1">R</th>
              <th className="border px-2 py-1">G</th>
              <th className="border px-2 py-1">B</th>
              <th className="border px-2 py-1">CIELAB</th>
              <th className="border px-2 py-1">LRV</th>
              <th className="border px-2 py-1">Type</th>
              <th className="border px-2 py-1">Sheen</th>
              <th className="border px-2 py-1">Location</th>
              <th className="border px-2 py-1">Opacity</th>
              <th className="border px-2 py-1">Base</th>
              <th className="border px-2 py-1">Volume</th>
              <th className="border px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paints.map((p, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="border px-2 py-1">
                  <div className="w-6 h-6 rounded border" style={{ backgroundColor: p.hex }}></div>
                </td>
                <td className="border px-2 py-1">{p.name}</td>
                <td className="border px-2 py-1">{p.mfr}</td>
                <td className="border px-2 py-1">{p.hex}</td>
                <td className="border px-2 py-1">{p.r}</td>
                <td className="border px-2 py-1">{p.g}</td>
                <td className="border px-2 py-1">{p.b}</td>
                <td className="border px-2 py-1">{p.cielab}</td>
                <td className="border px-2 py-1">{p.lrv}</td>
                <td className="border px-2 py-1">{p.type}</td>
                <td className="border px-2 py-1">{p.sheen}</td>
                <td className="border px-2 py-1">{p.location}</td>
                <td className="border px-2 py-1">{p.opacity}</td>
                <td className="border px-2 py-1">{p.base}</td>
                <td className="border px-2 py-1">{p.volume} {p.unit}</td>
                <td className="border px-2 py-1 space-x-2">
                  <button onClick={() => onSelectPaint(p, 2)} className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-xs">
                    Use in 2-Color
                  </button>
                  <button onClick={() => onSelectPaint(p, 3)} className="bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 text-xs">
                    Use in 3-Color
                  </button>
                  <button onClick={() => removePaint(idx)} className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-xs">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {paints.length === 0 && (
              <tr>
                <td colSpan="16" className="text-center py-4 text-gray-500">
                  No paints saved yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
