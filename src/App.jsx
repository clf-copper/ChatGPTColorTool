import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import TwoColor from "./components/2_color_mixer";
import ThreeColor from "./components/3_color_mixer";
import PaintPantry from "./components/PaintPantry";
import PantryMixRouter from "./components/PantryMixRouter";

function App() {
  return (
    <Router>
      <div className="p-6 space-y-8">
        <h1 className="text-3xl font-bold">🎨 Paint Pantry App</h1>

        {/* Navigation menu */}
        <nav className="space-x-4">
          <Link to="/">Home</Link>
          <Link to="/two-color">2-Color Mixer</Link>
          <Link to="/three-color">3-Color Mixer</Link>
        </nav>

        <Routes>
          {/* Home = Pantry + Router */}
          <Route
            path="/"
            element={
              <>
                <PaintPantry />
                <PantryMixRouter />
              </>
            }
          />

          {/* Two-color mixer */}
          <Route path="/two-color" element={<TwoColor />} />

          {/* Three-color mixer */}
          <Route path="/three-color" element={<ThreeColor />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
