import React from "react";
import TwoColor from "./components/2_color_section_latest_modular_build";
import ThreeColor from "./components/3_color_section_lrv_patched";
import PaintPantry from "./components/PaintPantry";

function App() {
  const handleSelectPaint = (paint, mixerType) => {
    console.log("Selected paint for mixer", mixerType, paint);
    // Later: wire this into mixers to auto-fill values
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-3xl font-bold">🎨 Paint Pantry App</h1>
      <TwoColor />
      <ThreeColor />
      <PaintPantry onSelectPaint={handleSelectPaint} />
    </div>
  );
}
