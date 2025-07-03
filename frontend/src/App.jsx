import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import "./App.css";

// 🔥 Custom HeatLayer using leaflet.heat
function HeatLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    const heat = window.L.heatLayer(points, {
      radius: 35,
      blur: 30,
      maxZoom: 17,
      gradient: {
        0.0: "#0000ff",   // blue (coldest)
        0.2: "#00ffff",   // cyan
        0.4: "#00ff00",   // green
        0.6: "#ffff00",   // yellow
        0.8: "#ff9900",   // orange
        1.0: "#ff0000"    // red (hottest)
      },
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [points, map]);

  return null;
}

function App() {
  const [form, setForm] = useState({
    city: "",
    lat: "",
    lon: "",
    powerScale: 1,
    delta: 0.2,
    scale: 0.05,
    price: 5,
    mode: "city",
  });

  const [result, setResult] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(true); // ✅ Toggle state

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8080/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      console.log("🔍 API Result:", data);
      setResult(data);
    } catch (err) {
      console.error("❌ Error in API request:", err);
    }
  };

  const heatPoints = [
    ...(result?.unfeasible || []),
    ...(result?.moderate || []),
    ...(result?.good || []),
    ...(result?.excellent || []),
  ].map(([lat, lon, val]) => [lat, lon, val / 50]); // More intense

  return (
    <div className="app">
      <h1>Solar Farm Feasibility Tool</h1>

      <form onSubmit={handleSubmit}>
        <select
          value={form.mode}
          onChange={e => setForm({ ...form, mode: e.target.value })}
        >
          <option value="city">Search by City</option>
          <option value="coords">Use Coordinates</option>
        </select>
        {form.mode === "city" ? (
          <input
            placeholder="City"
            value={form.city}
            onChange={e => setForm({ ...form, city: e.target.value })}
          />
        ) : (
          <>
            <input
              placeholder="Latitude"
              value={form.lat}
              onChange={e => setForm({ ...form, lat: e.target.value })}
            />
            <input
              placeholder="Longitude"
              value={form.lon}
              onChange={e => setForm({ ...form, lon: e.target.value })}
            />
          </>
        )}
        <input
          type="number"
          step="0.1"
          placeholder="Power (MW)"
          value={form.powerScale}
          onChange={e => setForm({ ...form, powerScale: e.target.value })}
        />
        <input
          type="number"
          step="0.05"
          placeholder="Delta"
          value={form.delta}
          onChange={e => setForm({ ...form, delta: e.target.value })}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Grid scale"
          value={form.scale}
          onChange={e => setForm({ ...form, scale: e.target.value })}
        />
        <input
          type="number"
          step="0.1"
          placeholder="Electricity Price ₹"
          value={form.price}
          onChange={e => setForm({ ...form, price: e.target.value })}
        />
        <button>Analyze</button>
      </form>

      {/* ✅ Toggle Button */}
      {result && (
        <button onClick={() => setShowHeatmap(!showHeatmap)} style={{ marginTop: "10px" }}>
          {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
        </button>
      )}

      {result && (
        <>
          <MapContainer
            center={result.maxCoords}
            zoom={10}
            style={{ height: "500px", marginTop: "20px" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {/* 🔥 Conditionally render heat layer */}
            {showHeatmap && <HeatLayer points={heatPoints} />}
            <Marker position={result.maxCoords}>
              <Popup>
                <strong>Max Irradiance:</strong> {result.max.toFixed(2)} kWh/m²/mo <br />
                <strong>Lat:</strong> {result.maxCoords[0].toFixed(4)} <br />
                <strong>Lon:</strong> {result.maxCoords[1].toFixed(4)}
              </Popup>
            </Marker>
          </MapContainer>

          <h3>Settlement: {result.settlement?.name}</h3>
          <p>CAPEX: ₹{result.settlement?.capex?.toFixed(2)} Cr</p>
          <p>Transmission Cost: ₹{result.settlement?.transmissionCost?.toFixed(2)} Cr</p>
          <p>Recovery Time: {result.settlement?.recoveryYears?.toFixed(1)} years</p>
        </>
      )}
    </div>
  );
}

export default App;
