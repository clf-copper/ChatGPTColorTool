// test Copilot review

import React from "react";
import TwoColor from "./components/2_color_mixer";
import ThreeColor from "./components/3_color_mixer";
import PaintPantry from "./components/PaintPantry";
import PantryMixRouter from "./components/PantryMixRouter";

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
